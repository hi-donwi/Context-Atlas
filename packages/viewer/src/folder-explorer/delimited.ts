/** The most data rows kept for display from one delimited file. */
export const MAX_TABLE_ROWS = 5000;

/** The most columns kept for display from one delimited file. */
export const MAX_TABLE_COLUMNS = 100;

/** A parsed CSV or TSV table: the first record is the header. */
export interface DelimitedTable {
  readonly header: string[];
  readonly rows: string[][];
  /** Data rows in the source, including any beyond the display bound. */
  readonly totalRows: number;
  readonly truncated: boolean;
}

export type SortDirection = 'asc' | 'desc';

function records(
  text: string,
  delimiter: string,
  keep: number,
): { rows: string[][]; total: number } {
  const rows: string[][] = [];
  let total = 0;
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;

  const endRow = () => {
    row.push(field);
    const blank = row.length === 1 && row[0] === '' && !fieldStarted;
    if (!blank) {
      total += 1;
      if (rows.length < keep) rows.push(row.slice(0, MAX_TABLE_COLUMNS));
    }
    row = [];
    field = '';
    fieldStarted = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
      fieldStarted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
      fieldStarted = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      endRow();
    } else {
      field += char;
      fieldStarted = true;
    }
  }
  if (field !== '' || row.length > 0 || fieldStarted) endRow();

  return { rows, total };
}

/** Parse RFC 4180-style delimited text into a bounded header-and-rows table. */
export function parseDelimited(text: string, delimiter: ',' | '\t'): DelimitedTable {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const { rows, total } = records(source, delimiter, MAX_TABLE_ROWS + 1);
  const [first = [], ...data] = rows;
  const width = Math.min(
    MAX_TABLE_COLUMNS,
    Math.max(first.length, ...data.map((row) => row.length)),
  );
  const header = Array.from({ length: width }, (_, index) => {
    const name = first[index]?.trim() ?? '';
    return name === '' ? `Column ${index + 1}` : name;
  });
  const padded = data
    .slice(0, MAX_TABLE_ROWS)
    .map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
  const totalRows = Math.max(0, total - 1);

  return { header, rows: padded, totalRows, truncated: totalRows > padded.length };
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Return rows sorted by one column in natural order; the input is not changed. */
export function sortRows(
  rows: readonly string[][],
  column: number,
  direction: SortDirection,
): string[][] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort(
    (left, right) => sign * collator.compare(left[column] ?? '', right[column] ?? ''),
  );
}

/** Return rows that contain the query in any cell, ignoring case and surrounding spaces. */
export function filterRows(rows: readonly string[][], query: string): string[][] {
  const needle = query.trim().toLocaleLowerCase('en-US');
  if (needle === '') return [...rows];
  return rows.filter((row) => row.some((cell) => cell.toLocaleLowerCase('en-US').includes(needle)));
}
