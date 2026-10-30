import type {
  ContextEdge,
  ContextNode,
  ContextSnapshot,
  ContextView,
  JsonValue,
} from '@context-atlas/model';
import { validateSnapshot } from '@context-atlas/model';
import { asJson, object, optionalText, resolveLocal, schemaReferences, text } from './parse.js';

export interface OpenApiImportOptions {
  projectId?: string;
  name?: string;
  sourcePath?: string;
}

export class OpenApiImportError extends Error {
  readonly code = 'INVALID_OPENAPI_DOCUMENT';
  constructor(message: string) {
    super(message);
    this.name = 'OpenApiImportError';
  }
}

const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const safeId = (value: string): string => encodeURIComponent(value);

export function importOpenApi(input: unknown, options: OpenApiImportOptions = {}): ContextSnapshot {
  try {
    const snapshot = project(input, options);
    const validation = validateSnapshot(snapshot);
    if (!validation.success) {
      const issue = validation.issues[0];
      throw new OpenApiImportError(
        `The projected context is invalid at ${issue?.path ?? '/'}: ${issue?.message ?? 'Unknown validation error'}.`,
      );
    }
    return snapshot;
  } catch (error) {
    if (error instanceof OpenApiImportError) throw error;
    throw new OpenApiImportError(
      error instanceof Error ? error.message : 'The OpenAPI document is invalid.',
    );
  }
}

function project(input: unknown, options: OpenApiImportOptions): ContextSnapshot {
  const document = object(input, 'OpenAPI document');
  const version = text(document.openapi, 'openapi version');
  if (!/^3\.[01]\.\d+(?:[-+].*)?$/.test(version))
    throw new OpenApiImportError('Only OpenAPI 3.0 and 3.1 JSON documents are supported.');
  const info = object(document.info, 'info');
  const title = text(info.title, 'info.title');
  const displayName = text(options.name ?? title, 'Project name');
  const contractVersion = text(info.version, 'info.version');
  const paths = object(document.paths, 'paths');
  const projectId =
    options.projectId ??
    (title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
      'imported-api');
  if (!projectId.trim()) throw new OpenApiImportError('A project ID must not be empty.');
  const sourcePath = options.sourcePath ?? 'openapi.json';
  if (
    !sourcePath ||
    /^(?:\/|[a-zA-Z][a-zA-Z\d+.-]*:)/.test(sourcePath) ||
    /[\\%\u0000-\u001f\u007f]/.test(sourcePath) ||
    sourcePath.split('/').some((part) => !part || part === '..' || part === '.')
  ) {
    throw new OpenApiImportError(
      'The source path must be a safe, unencoded repository-relative path without traversal or empty segments.',
    );
  }
  const sourceId = `${projectId}:source:openapi`;
  const nodes: ContextNode[] = [];
  const edges: ContextEdge[] = [];
  const moduleIds = new Map<string, string>();
  const schemaIds = new Map<string, string>();
  const base = {
    sourceIds: [sourceId],
    status: 'proposed',
    evidence: 'declared',
    tags: [],
  } as const;
  const components =
    document.components === undefined ? {} : object(document.components, 'components');
  const schemas =
    components.schemas === undefined ? {} : object(components.schemas, 'components.schemas');
  for (const [name, schemaValue] of Object.entries(schemas)) {
    const schema = typeof schemaValue === 'boolean' ? {} : object(schemaValue, `schema ${name}`);
    const id = `${projectId}:schema:${safeId(name)}`;
    schemaIds.set(name, id);
    const properties =
      schema.properties === undefined ? {} : object(schema.properties, `properties of ${name}`);
    const required = Array.isArray(schema.required) ? schema.required : [];
    nodes.push({
      ...base,
      sourceIds: [sourceId],
      tags: ['schema'],
      id,
      kind: 'entity',
      label: name,
      description:
        optionalText(schema.description) ??
        `Schema declared in the OpenAPI contract. This is not a physical database table.`,
      details: {
        fields: Object.entries(properties).map(([fieldName, fieldValue]) => {
          const field =
            typeof fieldValue === 'boolean' ? {} : object(fieldValue, `field ${fieldName}`);
          const description = optionalText(field.description);
          const reference = optionalText(field.$ref);
          const type =
            optionalText(field.type) ??
            (Array.isArray(field.type) ? field.type.join(' | ') : reference?.split('/').at(-1)) ??
            'unknown';
          return {
            name: fieldName,
            type,
            required: required.includes(fieldName),
            ...(description ? { description } : {}),
            ...(reference ? { references: reference } : {}),
          };
        }),
        code: JSON.stringify(asJson(schemaValue), null, 2),
      },
    });
  }
  const addLinks = (operationId: string, value: JsonValue, relation: string): void => {
    for (const name of schemaReferences(value)) {
      const target = schemaIds.get(name);
      if (target)
        edges.push({
          id: `${operationId}:${relation}:${safeId(name)}`,
          source: operationId,
          target,
          relation,
          sourceIds: [sourceId],
          evidence: 'declared',
        });
    }
  };
  for (const [path, pathValue] of Object.entries(paths)) {
    if (path.startsWith('x-')) continue;
    if (!path.startsWith('/'))
      throw new OpenApiImportError(`OpenAPI path "${path}" must begin with /. `);
    const pathItem = object(resolveLocal(document, pathValue), `path ${path}`);
    if (pathItem.$ref !== undefined)
      throw new OpenApiImportError(
        `Path ${path} uses an unresolved reference. Supply local path definitions.`,
      );
    for (const [method, operationValue] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      const operation = object(operationValue, `${method.toUpperCase()} ${path}`);
      const responsesInput = object(
        operation.responses,
        `responses for ${method.toUpperCase()} ${path}`,
      );
      const responseEntries: [string, JsonValue][] = [];
      for (const [status, responseValue] of Object.entries(responsesInput)) {
        if (status.startsWith('x-')) continue;
        if (!/^(?:[1-5](?:\d{2}|XX)|default)$/.test(status))
          throw new OpenApiImportError(
            `Response key "${status}" for ${path} must be an HTTP status, range, or default.`,
          );
        const response = object(
          resolveLocal(document, responseValue),
          `response ${status} for ${path}`,
        );
        responseEntries.push([status, asJson(response)]);
      }
      if (!responseEntries.length)
        throw new OpenApiImportError(
          `Responses for ${method.toUpperCase()} ${path} must declare at least one response.`,
        );
      const responses: Record<string, JsonValue> = Object.fromEntries(responseEntries);
      const tags = operation.tags === undefined ? ['General'] : operation.tags;
      if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string' || !tag.trim()))
        throw new OpenApiImportError(`Tags for ${path} must be nonempty strings.`);
      const tagNames = [...new Set(tags.length ? (tags as string[]) : ['General'])];
      const operationId = `${projectId}:operation:${method}:${safeId(path)}`;
      const assignedModules: string[] = [];
      for (const tag of tagNames) {
        let moduleId = moduleIds.get(tag);
        if (!moduleId) {
          moduleId = `${projectId}:module:${safeId(tag)}`;
          moduleIds.set(tag, moduleId);
          nodes.push({
            ...base,
            sourceIds: [sourceId],
            tags: [tag],
            id: moduleId,
            kind: 'module',
            label: tag,
            description: `Operations grouped by the declared ${tag} tag.`,
          });
        }
        assignedModules.push(moduleId);
        edges.push({
          id: `${moduleId}:contains:${operationId}`,
          source: moduleId,
          target: operationId,
          relation: 'contains',
          sourceIds: [sourceId],
          evidence: 'declared',
        });
      }
      const security = operation.security ?? document.security ?? [];
      if (!Array.isArray(security))
        throw new OpenApiImportError(`Security for ${path} must be an array.`);
      const securityNames = security.map((entry) =>
        Object.entries(object(entry, `security for ${path}`))
          .map(([name, scopes]) => {
            if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== 'string'))
              throw new OpenApiImportError(
                `Security scopes for ${path} must be an array of strings.`,
              );
            return scopes.length ? `${name} [${scopes.join(', ')}]` : name;
          })
          .join(' + '),
      );
      const authentication = securityNames.length
        ? securityNames.map((name) => name || 'Public').join(' or ')
        : 'Public';
      const effectiveParameters = new Map<string, JsonValue>();
      for (const value of [pathItem.parameters, operation.parameters]) {
        if (value === undefined) continue;
        if (!Array.isArray(value))
          throw new OpenApiImportError(`Parameters for ${path} must be an array.`);
        for (const parameterValue of value) {
          const parameter = object(resolveLocal(document, parameterValue), `parameter for ${path}`);
          const reference = optionalText(parameter.$ref);
          const key = reference
            ? `reference:${reference}`
            : `${text(parameter.in, `Parameter location for ${path}`)}:${text(parameter.name, `Parameter name for ${path}`)}`;
          effectiveParameters.set(key, asJson(parameter));
        }
      }
      const parameters = [...effectiveParameters.values()];
      const request =
        operation.requestBody === undefined
          ? undefined
          : asJson(
              object(resolveLocal(document, operation.requestBody), `request body for ${path}`),
            );
      nodes.push({
        ...base,
        sourceIds: [sourceId],
        tags: tagNames,
        id: operationId,
        kind: 'operation',
        label: optionalText(operation.summary) ?? `${method.toUpperCase()} ${path}`,
        description:
          optionalText(operation.description) ??
          `Declared ${method.toUpperCase()} ${path} operation. Runtime behavior has not been verified.`,
        moduleId: assignedModules[0]!,
        details: {
          endpoint: {
            method: method.toUpperCase(),
            path,
            authentication,
            responses,
            ...(request !== undefined ? { request } : {}),
            ...(parameters.length ? { parameters } : {}),
          },
          notes: [
            'Imported contract only; no implementation, deployment, or acceptance is implied.',
            ...(optionalText(operation.operationId)
              ? [`Declared operationId: ${String(operation.operationId)}`]
              : []),
          ],
        },
      });
      if (request !== undefined) addLinks(operationId, request, 'accepts');
      addLinks(operationId, responses, 'returns');
    }
  }
  const allIds = nodes.map((node) => node.id);
  const apiIds = nodes.filter((node) => node.kind !== 'module').map((node) => node.id);
  const views: ContextView[] = [
    {
      id: 'overview',
      kind: 'overview',
      label: 'Overview',
      description: 'A source-linked overview of the imported API contract.',
      nodeIds: allIds,
    },
    {
      id: 'api',
      kind: 'api',
      label: 'API reference',
      description: 'Declared operations, inputs, responses, and schema references.',
      nodeIds: apiIds,
    },
  ];
  if (schemaIds.size)
    views.push({
      id: 'data',
      kind: 'data',
      label: 'Data schemas',
      description: 'Contract schemas, not physical database structure.',
      nodeIds: [...schemaIds.values()],
    });
  return {
    schemaVersion: '1.0',
    project: {
      id: projectId,
      name: displayName,
      description:
        optionalText(info.description) ??
        'Imported OpenAPI contract. All facts are declared and remain unverified.',
      kind: 'api',
      capabilities: views.map((view) => view.kind),
      tags: ['imported', 'openapi'],
      version: contractVersion,
    },
    sources: [
      {
        id: sourceId,
        label: 'Imported OpenAPI contract',
        path: sourcePath,
        revision: contractVersion,
        freshness: 'unknown',
      },
    ],
    nodes,
    edges,
    views,
  };
}
