import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { FileSystemSourceError, type FileSystemSourceErrorCode } from './filesystem-source.js';
import {
  isExcludedPath,
  isPathWithinRoot,
  MAX_SEARCH_RESULTS,
  normalizeRelativePath,
  normalizeSearchQuery,
  UnsafePathError,
  type ContentSource,
  type FileContent,
} from '@context-atlas/core';

const API_PREFIX = '/atlas/api/';
const MAX_TEXT_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_UI_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EVENT_PATHS = 128;
const MAX_EVENT_PATH_LENGTH = 4096;

const UI_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

type ApiErrorCode =
  | FileSystemSourceErrorCode
  | 'HOST_NOT_ALLOWED'
  | 'METHOD_NOT_ALLOWED'
  | 'ROUTE_NOT_FOUND'
  | 'INVALID_QUERY'
  | 'SEARCH_NOT_SUPPORTED'
  | 'EVENTS_NOT_SUPPORTED';

interface ProblemDetails {
  readonly type: 'about:blank';
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly code: ApiErrorCode;
}

interface FileResponse {
  readonly path: string;
  readonly type: FileContent['type'];
  readonly content: string;
  readonly encoding: 'utf-8' | 'base64';
  readonly size: number;
  readonly mtime?: string;
}

interface ServerOptions {
  /** Bind to an available port with `0`; the server always binds to `127.0.0.1`. */
  readonly port?: number;
  /** Optional root containing the fixed, built browser UI bundle. */
  readonly uiDirectory?: string;
}

interface UiRoot {
  readonly path: string;
  readonly indexPath: string;
}

class ApiRequestError extends Error {
  readonly code = 'INVALID_QUERY' as const;
}

/** A running loopback-only Atlas API server. */
export interface LocalApiServer {
  /** URL bound to the IPv4 loopback interface. */
  readonly url: string;
  /** Actual port selected by the operating system. */
  readonly port: number;
  /** Stop accepting requests and close the listener. */
  close(): Promise<void>;
}

function errorDetails(code: ApiErrorCode): { readonly status: number; readonly detail: string } {
  switch (code) {
    case 'HOST_NOT_ALLOWED':
      return { status: 403, detail: 'The request host is not permitted.' };
    case 'METHOD_NOT_ALLOWED':
      return { status: 405, detail: 'Only GET requests are supported.' };
    case 'ROUTE_NOT_FOUND':
    case 'NOT_FOUND':
    case 'INVALID_SCOPE':
      return { status: 404, detail: 'The requested resource was not found.' };
    case 'INVALID_PATH':
      return { status: 400, detail: 'The path is not a safe relative path.' };
    case 'INVALID_QUERY':
      return { status: 400, detail: 'The query parameters are invalid.' };
    case 'SEARCH_NOT_SUPPORTED':
      return { status: 501, detail: 'Search is not supported by this source.' };
    case 'EVENTS_NOT_SUPPORTED':
      return { status: 501, detail: 'Change events are not supported by this source.' };
    case 'FILE_TOO_LARGE':
      return { status: 413, detail: 'The file exceeds the response size limit.' };
    case 'FILE_CHANGED':
      return { status: 409, detail: 'The file changed while it was being read.' };
    case 'INVALID_ROOT':
    case 'INVALID_METADATA':
    case 'UNSUPPORTED_METADATA':
    case 'FILESYSTEM_ERROR':
      return { status: 500, detail: 'The local source could not complete the request.' };
  }
}

function statusTitle(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 405:
      return 'Method Not Allowed';
    case 409:
      return 'Conflict';
    case 413:
      return 'Content Too Large';
    case 501:
      return 'Not Implemented';
    default:
      return 'Internal Server Error';
  }
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const serialized = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(serialized));
  response.end(serialized);
}

function sendProblem(
  response: ServerResponse,
  route: string,
  code: ApiErrorCode,
  allowGet = false,
): void {
  const { status, detail } = errorDetails(code);
  const problem: ProblemDetails = {
    type: 'about:blank',
    title: statusTitle(status),
    status,
    detail,
    instance: route,
    code,
  };
  if (allowGet) response.setHeader('Allow', 'GET');
  response.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
  const serialized = JSON.stringify(problem);
  response.statusCode = status;
  response.setHeader('Content-Length', Buffer.byteLength(serialized));
  response.end(serialized);
}

function validateQuery(url: URL, allowed: readonly string[]): void {
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) {
      throw new ApiRequestError();
    }
  }
}

function requiredParameter(url: URL, name: string): string {
  const values = url.searchParams.getAll(name);
  if (values.length !== 1 || values[0] === '') {
    throw new ApiRequestError();
  }
  return values[0]!;
}

function optionalParameter(url: URL, name: string, fallback: string): string {
  const values = url.searchParams.getAll(name);
  if (values.length > 1) throw new ApiRequestError();
  return values[0] ?? fallback;
}

function asFileResponse(file: FileContent): FileResponse {
  if (typeof file.content === 'string') {
    return {
      path: file.path,
      type: file.type,
      content: file.content,
      encoding: 'utf-8',
      size: file.size,
      ...(file.mtime === undefined ? {} : { mtime: file.mtime }),
    };
  }

  return {
    path: file.path,
    type: file.type,
    content: Buffer.from(file.content).toString('base64'),
    encoding: 'base64',
    size: file.size,
    ...(file.mtime === undefined ? {} : { mtime: file.mtime }),
  };
}

function sourceErrorCode(error: unknown): ApiErrorCode {
  if (error instanceof ApiRequestError) return error.code;
  return error instanceof FileSystemSourceError ? error.code : 'FILESYSTEM_ERROR';
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  source: ContentSource,
  expectedHost: string,
  baseUrl: string,
  uiRoot: UiRoot | undefined,
  eventStreams: Map<ServerResponse, () => void>,
): Promise<void> {
  setSecurityHeaders(response);

  let url: URL;
  try {
    url = new URL(request.url ?? '/', baseUrl);
  } catch {
    sendProblem(response, '/', 'INVALID_QUERY');
    return;
  }

  const route = url.pathname;
  if (request.headers.host !== expectedHost) {
    sendProblem(response, route, 'HOST_NOT_ALLOWED');
    return;
  }
  if (request.method !== 'GET') {
    sendProblem(response, route, 'METHOD_NOT_ALLOWED', true);
    return;
  }

  try {
    switch (route) {
      case `${API_PREFIX}info`:
        validateQuery(url, []);
        sendJson(response, 200, await source.describe());
        return;

      case `${API_PREFIX}tree`: {
        validateQuery(url, ['scope', 'dir']);
        const scopeId = requiredParameter(url, 'scope');
        const dir = optionalParameter(url, 'dir', '');
        sendJson(response, 200, await source.list(scopeId, dir));
        return;
      }

      case `${API_PREFIX}file`: {
        validateQuery(url, ['scope', 'path']);
        const scopeId = requiredParameter(url, 'scope');
        const path = requiredParameter(url, 'path');
        const file = await source.read(scopeId, path);
        const fileResponse = asFileResponse(file);
        const serialized = JSON.stringify(fileResponse);
        if (
          fileResponse.encoding === 'utf-8' &&
          Buffer.byteLength(serialized) > MAX_TEXT_RESPONSE_BYTES
        ) {
          sendProblem(response, route, 'FILE_TOO_LARGE');
          return;
        }
        sendJson(response, 200, fileResponse);
        return;
      }

      case `${API_PREFIX}search`: {
        validateQuery(url, ['scope', 'q']);
        const scopeId = requiredParameter(url, 'scope');
        const query = normalizeSearchQuery(requiredParameter(url, 'q'));
        if (query === undefined) throw new ApiRequestError();
        if (source.search === undefined) {
          sendProblem(response, route, 'SEARCH_NOT_SUPPORTED');
          return;
        }
        const hits = await source.search(scopeId, query);
        sendJson(response, 200, hits.slice(0, MAX_SEARCH_RESULTS));
        return;
      }

      case `${API_PREFIX}events`:
        validateQuery(url, []);
        if (source.watch === undefined) {
          sendProblem(response, route, 'EVENTS_NOT_SUPPORTED');
          return;
        }
        openEventStream(response, source, eventStreams);
        return;

      default:
        if (uiRoot !== undefined && !route.startsWith(API_PREFIX)) {
          await serveUiRoute(url, response, uiRoot);
        } else {
          sendProblem(response, route, 'ROUTE_NOT_FOUND');
        }
    }
  } catch (error) {
    sendProblem(response, route, sourceErrorCode(error));
  }
}

function normalizeEventPaths(paths: string[]): string[] | undefined {
  if (!Array.isArray(paths)) return [];
  if (paths.length === 0) return [];
  if (paths.length > MAX_EVENT_PATHS) return [];

  const safePaths = new Set<string>();
  for (const path of paths) {
    if (typeof path !== 'string' || path.length > MAX_EVENT_PATH_LENGTH) return [];
    try {
      const normalized = normalizeRelativePath(path);
      if (normalized !== path) return [];
      if (!isExcludedPath(normalized)) safePaths.add(normalized);
    } catch (error) {
      if (error instanceof UnsafePathError) return [];
      throw error;
    }
  }
  return safePaths.size === 0 ? undefined : [...safePaths].sort();
}

function openEventStream(
  response: ServerResponse,
  source: ContentSource,
  eventStreams: Map<ServerResponse, () => void>,
): void {
  const pendingEvents: string[][] = [];
  let ready = false;
  let closed = false;
  let unsubscribe = (): void => undefined;

  const writeChange = (paths: string[]): void => {
    const safePaths = normalizeEventPaths(paths);
    if (safePaths === undefined) return;
    if (!ready) {
      pendingEvents.push(safePaths);
      return;
    }
    if (!response.destroyed && !response.writableEnded) {
      response.write(`event: change\ndata: ${JSON.stringify({ paths: safePaths })}\n\n`);
    }
  };

  try {
    unsubscribe = source.watch!(writeChange);
  } catch {
    sendProblem(response, `${API_PREFIX}events`, 'FILESYSTEM_ERROR');
    return;
  }

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    eventStreams.delete(response);
    try {
      unsubscribe();
    } catch {
      // A faulty source must not prevent the HTTP stream from being released.
    }
  };

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();
  eventStreams.set(response, cleanup);
  response.once('close', cleanup);
  response.once('error', cleanup);
  if (response.destroyed || response.writableEnded) {
    cleanup();
    return;
  }
  response.write(': connected\n\n');
  ready = true;
  for (const paths of pendingEvents) writeChange(paths);
  pendingEvents.length = 0;
}

async function openUiRoot(directory: string): Promise<UiRoot> {
  try {
    const path = await realpath(directory);
    const directoryStat = await stat(path);
    if (!directoryStat.isDirectory()) throw new Error('not a directory');

    const indexPath = await realpath(join(path, 'index.html'));
    const indexStat = await stat(indexPath);
    if (!isPathWithinRoot(path, indexPath) || !indexStat.isFile()) {
      throw new Error('invalid index file');
    }
    return { path, indexPath };
  } catch {
    throw new Error('The bundled browser UI is unavailable.');
  }
}

async function serveUiRoute(url: URL, response: ServerResponse, uiRoot: UiRoot): Promise<void> {
  if (url.search !== '') {
    sendProblem(response, url.pathname, 'INVALID_QUERY');
    return;
  }

  let targetPath: string;
  let contentType: string;
  if (url.pathname === '/') {
    targetPath = uiRoot.indexPath;
    contentType = 'text/html; charset=utf-8';
  } else if (url.pathname.startsWith('/assets/')) {
    let normalizedPath: string;
    try {
      normalizedPath = normalizeRelativePath(decodeURIComponent(url.pathname.slice(1)));
    } catch (error) {
      if (error instanceof UnsafePathError || error instanceof URIError) {
        sendProblem(response, url.pathname, 'ROUTE_NOT_FOUND');
        return;
      }
      throw error;
    }

    const extension = extname(normalizedPath).toLowerCase();
    const assetContentType = UI_CONTENT_TYPES[extension];
    if (!normalizedPath.startsWith('assets/') || assetContentType === undefined) {
      sendProblem(response, url.pathname, 'ROUTE_NOT_FOUND');
      return;
    }
    targetPath = join(uiRoot.path, ...normalizedPath.split('/'));
    contentType = assetContentType;
  } else {
    sendProblem(response, url.pathname, 'ROUTE_NOT_FOUND');
    return;
  }

  try {
    const resolvedPath = await realpath(targetPath);
    if (!isPathWithinRoot(uiRoot.path, resolvedPath)) {
      sendProblem(response, url.pathname, 'ROUTE_NOT_FOUND');
      return;
    }
    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) {
      sendProblem(response, url.pathname, 'ROUTE_NOT_FOUND');
      return;
    }
    if (fileStat.size > MAX_UI_FILE_BYTES) {
      sendProblem(response, url.pathname, 'FILE_TOO_LARGE');
      return;
    }

    const content = await readFile(resolvedPath);
    if (content.byteLength > MAX_UI_FILE_BYTES) {
      sendProblem(response, url.pathname, 'FILE_TOO_LARGE');
      return;
    }
    response.statusCode = 200;
    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', content.byteLength);
    response.end(content);
  } catch {
    sendProblem(response, url.pathname, 'ROUTE_NOT_FOUND');
  }
}

/** Start the local read-only API on an available port, bound exclusively to `127.0.0.1`. */
export async function startLocalApiServer(
  source: ContentSource,
  options: ServerOptions = {},
): Promise<LocalApiServer> {
  const port = options.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('Port must be an integer from 0 to 65535.');
  }

  const uiRoot =
    options.uiDirectory === undefined ? undefined : await openUiRoot(options.uiDirectory);

  let expectedHost = '';
  let baseUrl = '';
  const eventStreams = new Map<ServerResponse, () => void>();
  const server: Server = createServer((request, response) => {
    void routeRequest(request, response, source, expectedHost, baseUrl, uiRoot, eventStreams).catch(
      () => {
        if (response.headersSent || response.destroyed) return;
        sendProblem(response, '/', 'FILESYSTEM_ERROR');
      },
    );
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (error: Error): void => rejectListen(error);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolveListen();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    throw new Error('The local API listener did not provide a TCP address.');
  }

  expectedHost = `127.0.0.1:${address.port}`;
  baseUrl = `http://${expectedHost}`;
  let closePromise: Promise<void> | undefined;

  return {
    url: baseUrl,
    port: address.port,
    close: () => {
      if (closePromise !== undefined) return closePromise;
      for (const [response, cleanup] of eventStreams) {
        cleanup();
        response.end();
      }
      closePromise = new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
      return closePromise;
    },
  };
}
