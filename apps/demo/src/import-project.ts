import { importOpenApi } from '@context-atlas/adapter-openapi';
import { validateSnapshot, type ContextSnapshot } from '@context-atlas/model';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function parseProjectText(text: string, filename: string): ContextSnapshot {
  if (!filename.toLowerCase().endsWith('.json'))
    throw new Error('Choose a JSON snapshot or OpenAPI JSON document.');
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new Error('Choose a file smaller than 5 MB.');
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. Check its syntax and import it again.');
  }
  const isSnapshot =
    typeof document === 'object' && document !== null && 'schemaVersion' in document;
  const candidate = isSnapshot
    ? document
    : importOpenApi(document, { sourcePath: 'imports/openapi.json' });
  const result = validateSnapshot(candidate);
  if (!result.success)
    throw new Error(
      `Invalid context snapshot: ${result.issues
        .slice(0, 3)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}`,
    );
  if (result.snapshot.nodes.length > 1000)
    throw new Error(
      'This browser demo supports up to 1,000 objects per snapshot. Import a smaller project slice.',
    );
  return result.snapshot;
}
