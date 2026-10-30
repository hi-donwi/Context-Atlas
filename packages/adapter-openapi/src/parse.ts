import type { JsonValue } from '@context-atlas/model';

export function object(value: unknown, location: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${location} must be a JSON object.`);
  return value as Record<string, unknown>;
}

export function text(value: unknown, location: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${location} must be a nonempty string.`);
  return value;
}

export const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

export function asJson(value: unknown, seen: Set<object> = new Set()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || seen.has(value))
    throw new Error('The contract must contain finite JSON values without cycles.');
  seen.add(value);
  const result: JsonValue = Array.isArray(value)
    ? value.map((item) => asJson(item, seen))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, asJson(item, seen)]));
  seen.delete(value);
  return result;
}

export function resolveLocal(document: Record<string, unknown>, input: unknown): unknown {
  let current = input;
  const seen = new Set<string>();
  while (current !== null && typeof current === 'object' && !Array.isArray(current)) {
    const reference = (current as Record<string, unknown>).$ref;
    if (typeof reference !== 'string' || !reference.startsWith('#/')) return current;
    if (seen.has(reference)) throw new Error(`Circular local reference: ${reference}.`);
    seen.add(reference);
    let resolved: unknown = document;
    for (const segment of reference.slice(2).split('/')) {
      const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
      const parent = object(resolved, `reference ${reference}`);
      if (!Object.hasOwn(parent, key)) throw new Error(`Unresolved local reference: ${reference}.`);
      resolved = parent[key];
    }
    current = resolved;
  }
  return current;
}

export function schemaReferences(value: JsonValue): string[] {
  const names = new Set<string>();
  const visit = (item: JsonValue): void => {
    if (item === null || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    const reference = item.$ref;
    if (typeof reference === 'string' && reference.startsWith('#/components/schemas/'))
      names.add(
        reference.slice('#/components/schemas/'.length).replace(/~1/g, '/').replace(/~0/g, '~'),
      );
    Object.values(item).forEach(visit);
  };
  visit(value);
  return [...names];
}
