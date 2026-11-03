import type { FileType } from './index.js';

/** Frontmatter fields used by document titles and wiki-link lookup. */
export interface FrontmatterMetadata {
  readonly title?: string;
  readonly name?: string;
}

const FILE_TYPES: Readonly<Record<string, FileType>> = {
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  mmd: 'mermaid',
  mermaid: 'mermaid',
  json: 'json',
  jsonl: 'jsonl',
  yaml: 'yaml',
  yml: 'yaml',
  csv: 'csv',
  tsv: 'tsv',
  bpmn: 'bpmn',
  svg: 'image',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  avif: 'image',
  bmp: 'image',
  webp: 'image',
  gif: 'image',
  ico: 'image',
  tif: 'image',
  tiff: 'image',
  pdf: 'pdf',
  html: 'html',
  htm: 'html',
  zip: 'binary',
  gz: 'binary',
  tgz: 'binary',
  tar: 'binary',
  bz2: 'binary',
  xz: 'binary',
  '7z': 'binary',
  rar: 'binary',
  bin: 'binary',
  exe: 'binary',
  dll: 'binary',
  so: 'binary',
  dylib: 'binary',
  wasm: 'binary',
  doc: 'binary',
  docx: 'binary',
  xls: 'binary',
  xlsx: 'binary',
  ppt: 'binary',
  pptx: 'binary',
  mp3: 'binary',
  m4a: 'binary',
  mp4: 'binary',
  mov: 'binary',
  avi: 'binary',
  webm: 'binary',
  ogg: 'binary',
  txt: 'text',
  text: 'text',
  log: 'text',
  js: 'text',
  jsx: 'text',
  mjs: 'text',
  cjs: 'text',
  ts: 'text',
  tsx: 'text',
  css: 'text',
  scss: 'text',
  less: 'text',
  xml: 'text',
  toml: 'text',
  ini: 'text',
  conf: 'text',
  sh: 'text',
  bash: 'text',
  zsh: 'text',
  py: 'text',
  java: 'text',
  go: 'text',
  rs: 'text',
  c: 'text',
  h: 'text',
  cpp: 'text',
  hpp: 'text',
  sql: 'text',
};

/** Detect a renderer family from a file path without reading its contents. */
export function detectFileType(path: string): FileType {
  const fileName = path.split('/').at(-1);
  if (fileName === undefined || fileName === '') return 'unknown';

  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === fileName.length - 1) return 'unknown';

  const extension = fileName.slice(extensionIndex + 1).toLowerCase();
  return Object.prototype.hasOwnProperty.call(FILE_TYPES, extension)
    ? FILE_TYPES[extension]!
    : 'unknown';
}

function parseScalar(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    const unquoted = trimmed.slice(1, -1);
    const result =
      quote === "'" ? unquoted.replace(/''/g, "'") : unquoted.replace(/\\(["\\])/g, '$1');
    return result.trim() === '' ? undefined : result;
  }

  const scalar = trimmed.replace(/\s+#.*$/, '').trim();
  return scalar === '' ? undefined : scalar;
}

function frontmatter(
  markdown: string,
): { readonly metadata: FrontmatterMetadata; readonly body: string[] } | undefined {
  const normalized = markdown.charCodeAt(0) === 0xfeff ? markdown.slice(1) : markdown;
  const lines = normalized.split(/\r\n|\n|\r/);
  if (lines[0]?.trim() !== '---') return undefined;

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) return undefined;

  const metadata: { title?: string; name?: string } = {};
  for (const line of lines.slice(1, closingIndex)) {
    const field = /^(title|name)\s*:\s*(.*?)\s*$/.exec(line);
    if (field === null) continue;

    const key = field[1] as 'title' | 'name';
    if (metadata[key] === undefined) {
      const value = parseScalar(field[2] ?? '');
      if (value !== undefined) metadata[key] = value;
    }
  }

  return { metadata, body: lines.slice(closingIndex + 1) };
}

/** Extract the supported title and wiki-name scalars from a YAML frontmatter block. */
export function extractFrontmatterMetadata(markdown: string): FrontmatterMetadata {
  return frontmatter(markdown)?.metadata ?? {};
}

function firstHeading(lines: readonly string[]): string | undefined {
  let fence: { readonly marker: string; readonly length: number } | undefined;

  for (const line of lines) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1]![0]!;
      const markerLength = fenceMatch[1]!.length;
      if (fence === undefined) {
        fence = { marker, length: markerLength };
      } else if (
        marker === fence.marker &&
        markerLength >= fence.length &&
        (fenceMatch[2] ?? '').trim() === ''
      ) {
        fence = undefined;
      }
      continue;
    }

    if (fence !== undefined) continue;
    const heading = /^ {0,3}#\s+(.+?)\s*#*\s*$/.exec(line)?.[1]?.trim();
    if (heading !== undefined && heading !== '') return heading;
  }

  return undefined;
}

/** Prefer a frontmatter title, then the first level-one Markdown heading outside code fences. */
export function extractTitle(markdown: string): string | undefined {
  const parsed = frontmatter(markdown);
  return parsed?.metadata.title ?? firstHeading(parsed?.body ?? markdown.split(/\r\n|\n|\r/));
}
