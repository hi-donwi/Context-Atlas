/** The most top-level frontmatter fields returned for display. */
export const MAX_FRONTMATTER_FIELDS = 50;

/** The most characters kept for one frontmatter value before it is truncated. */
export const MAX_FRONTMATTER_VALUE_CHARS = 2000;

/** One top-level frontmatter field, as display text. */
export interface FrontmatterField {
  readonly key: string;
  /** A scalar as text, or a nested mapping or list as dedented source text. */
  readonly value: string;
  /** `text` for scalars and block scalars; `structured` for nested mappings and lists. */
  readonly kind: 'text' | 'structured';
}

/** A Markdown document split into its frontmatter fields and its body. */
export interface SplitFrontmatter {
  readonly fields: FrontmatterField[];
  readonly body: string;
}

const KEY_LINE = /^([A-Za-z0-9_][A-Za-z0-9_ .-]*?)\s*:(?:\s+(.*?))?\s*$/;
const BLOCK_SCALAR = /^([>|])([+-]?)\s*(?:#.*)?$/;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.length >= 2 && trimmed.at(-1) === quote) {
    const inner = trimmed.slice(1, -1);
    return quote === "'" ? inner.replace(/''/g, "'") : inner.replace(/\\(["\\])/g, '$1');
  }
  return trimmed.replace(/\s+#.*$/, '').trim();
}

function dedent(lines: readonly string[]): string[] {
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => /^[ \t]*/.exec(line)![0].length);
  const indent = indents.length === 0 ? 0 : Math.min(...indents);
  const result = lines.map((line) => line.slice(indent).replace(/\s+$/, ''));
  while (result.length > 0 && result.at(-1) === '') result.pop();
  while (result.length > 0 && result[0] === '') result.shift();
  return result;
}

function fold(lines: readonly string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) paragraphs.push(current.join(' '));
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) paragraphs.push(current.join(' '));
  return paragraphs.join('\n');
}

function bound(value: string): string {
  return value.length > MAX_FRONTMATTER_VALUE_CHARS
    ? `${value.slice(0, MAX_FRONTMATTER_VALUE_CHARS)}…`
    : value;
}

function toField(key: string, inline: string, continuation: readonly string[]): FrontmatterField {
  const block = BLOCK_SCALAR.exec(inline);
  const lines = dedent(continuation);
  if (block !== null) {
    const value = block[1] === '>' ? fold(lines) : lines.join('\n');
    return { key, value: bound(value), kind: 'text' };
  }
  if (inline !== '') {
    const extra = lines.map((line) => line.trim()).filter((line) => line !== '');
    return { key, value: bound([unquote(inline), ...extra].join(' ')), kind: 'text' };
  }
  if (lines.length === 0) return { key, value: '', kind: 'text' };
  return { key, value: bound(lines.join('\n')), kind: 'structured' };
}

/**
 * Split a leading YAML frontmatter block from Markdown and describe its top-level fields as
 * display text. This is deliberately not a YAML evaluator: it never resolves anchors, tags,
 * or types, and nested content is returned as dedented source text.
 */
export function splitFrontmatter(markdown: string): SplitFrontmatter | undefined {
  const normalized = markdown.charCodeAt(0) === 0xfeff ? markdown.slice(1) : markdown;
  const lines = normalized.split(/\r\n|\n|\r/);
  if (lines[0]?.trim() !== '---') return undefined;

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) return undefined;

  const fields: FrontmatterField[] = [];
  let current: { key: string; inline: string; continuation: string[] } | undefined;
  const flush = () => {
    if (current !== undefined && fields.length < MAX_FRONTMATTER_FIELDS) {
      fields.push(toField(current.key, current.inline, current.continuation));
    }
    current = undefined;
  };

  for (const line of lines.slice(1, closingIndex)) {
    const topLevel = line !== '' && !/^[ \t]/.test(line);
    if (topLevel && line.trimStart().startsWith('#')) continue;
    const keyMatch = topLevel ? KEY_LINE.exec(line) : null;
    if (keyMatch !== null) {
      flush();
      current = { key: keyMatch[1]!, inline: keyMatch[2] ?? '', continuation: [] };
    } else if (current !== undefined && (!topLevel || line.trim().startsWith('- '))) {
      current.continuation.push(line);
    }
  }
  flush();

  return { fields, body: lines.slice(closingIndex + 1).join('\n') };
}
