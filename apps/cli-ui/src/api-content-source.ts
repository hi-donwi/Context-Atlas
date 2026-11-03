import type {
  ContentSource,
  Entry,
  FileContent,
  FileType,
  ScopeInfo,
  SourceInfo,
} from '@context-atlas/core';

const API_PREFIX = '/atlas/api';

const FILE_TYPES: ReadonlySet<string> = new Set([
  'markdown',
  'mermaid',
  'json',
  'jsonl',
  'yaml',
  'csv',
  'tsv',
  'bpmn',
  'image',
  'pdf',
  'html',
  'text',
  'binary',
  'unknown',
]);

const SCOPE_PROFILES: ReadonlySet<string> = new Set(['folder', 'workspace', 'host']);

/** A safe protocol error returned when the local API response does not match its contract. */
export class LocalApiProtocolError extends Error {
  constructor() {
    super('The local source returned an invalid response.');
    this.name = 'LocalApiProtocolError';
  }
}

/** An RFC 9457 error returned by the local API, with stable status and code fields. */
export class LocalApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LocalApiRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFileType(value: unknown): value is FileType {
  return typeof value === 'string' && FILE_TYPES.has(value);
}

function isScopeInfo(value: unknown): value is ScopeInfo {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.revision === undefined || typeof value.revision === 'string')
  );
}

function parseSourceInfo(value: unknown): SourceInfo {
  if (
    !isRecord(value) ||
    typeof value.title !== 'string' ||
    typeof value.profile !== 'string' ||
    !SCOPE_PROFILES.has(value.profile) ||
    !Array.isArray(value.scopes) ||
    !value.scopes.every(isScopeInfo)
  ) {
    throw new LocalApiProtocolError();
  }

  return value as unknown as SourceInfo;
}

function parseEntry(value: unknown): Entry {
  if (
    !isRecord(value) ||
    typeof value.path !== 'string' ||
    typeof value.name !== 'string' ||
    (value.kind !== 'dir' && value.kind !== 'file') ||
    !isFileType(value.type) ||
    (value.title !== undefined && typeof value.title !== 'string') ||
    (value.size !== undefined &&
      (typeof value.size !== 'number' || !Number.isSafeInteger(value.size) || value.size < 0)) ||
    (value.mtime !== undefined && typeof value.mtime !== 'string')
  ) {
    throw new LocalApiProtocolError();
  }

  return value as unknown as Entry;
}

function parseFileContent(value: unknown): FileContent {
  if (
    !isRecord(value) ||
    typeof value.path !== 'string' ||
    !isFileType(value.type) ||
    typeof value.content !== 'string' ||
    (value.encoding !== 'utf-8' && value.encoding !== 'base64') ||
    typeof value.size !== 'number' ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    (value.mtime !== undefined && typeof value.mtime !== 'string')
  ) {
    throw new LocalApiProtocolError();
  }

  if (value.encoding === 'utf-8') {
    const content = value.content as string;
    if (new TextEncoder().encode(content).byteLength !== value.size) {
      throw new LocalApiProtocolError();
    }
    return {
      path: value.path,
      type: value.type,
      content,
      size: value.size as number,
      ...(value.mtime === undefined ? {} : { mtime: value.mtime as string }),
    };
  }

  let decoded: string;
  try {
    decoded = atob(value.content as string);
  } catch {
    throw new LocalApiProtocolError();
  }
  if (decoded.length !== value.size) throw new LocalApiProtocolError();

  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return {
    path: value.path,
    type: value.type,
    content: bytes,
    size: value.size as number,
    ...(value.mtime === undefined ? {} : { mtime: value.mtime as string }),
  };
}

function safeProblem(value: unknown, status: number): LocalApiRequestError {
  const code =
    isRecord(value) && typeof value.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(value.code)
      ? value.code
      : 'LOCAL_API_ERROR';
  const message =
    isRecord(value) && typeof value.detail === 'string' && value.detail.length <= 300
      ? value.detail
      : 'The local source could not complete the request.';
  return new LocalApiRequestError(status, code, message);
}

function createRequester(fetcher: typeof fetch) {
  return async (path: string): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetcher(path, { headers: { Accept: 'application/json' } });
    } catch {
      throw new LocalApiRequestError(
        0,
        'LOCAL_API_UNAVAILABLE',
        'The local source could not be reached. Try again.',
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LocalApiProtocolError();
    }
    if (!response.ok) throw safeProblem(body, response.status);
    return body;
  };
}

/** Create a browser-safe `ContentSource` backed only by the same-origin local CLI API. */
export function createApiContentSource(fetcher: typeof fetch = fetch): ContentSource {
  const request = createRequester(fetcher);

  return {
    async describe(): Promise<SourceInfo> {
      return parseSourceInfo(await request(`${API_PREFIX}/info`));
    },

    async list(scopeId: string, dir: string): Promise<Entry[]> {
      const query = new URLSearchParams({ scope: scopeId, dir });
      const value = await request(`${API_PREFIX}/tree?${query.toString()}`);
      if (!Array.isArray(value)) throw new LocalApiProtocolError();
      return value.map(parseEntry);
    },

    async read(scopeId: string, path: string): Promise<FileContent> {
      const query = new URLSearchParams({ scope: scopeId, path });
      return parseFileContent(await request(`${API_PREFIX}/file?${query.toString()}`));
    },
  };
}
