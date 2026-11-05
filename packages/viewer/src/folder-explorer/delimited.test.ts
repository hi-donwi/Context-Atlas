import { describe, expect, it } from 'vitest';
import { filterRows, MAX_TABLE_ROWS, parseDelimited, sortRows } from './delimited.js';

describe('parseDelimited', () => {
  it('reads a header and rows with quoted fields, escaped quotes, and CRLF', () => {
    const table = parseDelimited(
      'method,path,note\r\nGET,/health,"plain"\r\nPOST,/orders,"a, b and ""c"""\r\n',
      ',',
    );

    expect(table.header).toEqual(['method', 'path', 'note']);
    expect(table.rows).toEqual([
      ['GET', '/health', 'plain'],
      ['POST', '/orders', 'a, b and "c"'],
    ]);
    expect(table.totalRows).toBe(2);
    expect(table.truncated).toBe(false);
  });

  it('keeps a line break inside a quoted field', () => {
    const table = parseDelimited('a,b\n"line one\nline two",x', ',');

    expect(table.rows).toEqual([['line one\nline two', 'x']]);
  });

  it('reads tab-separated values and pads ragged rows', () => {
    const table = parseDelimited('key\tclient\tfolder\nshort\none\textra\tcells\tmore', '\t');

    expect(table.header).toEqual(['key', 'client', 'folder', 'Column 4']);
    expect(table.rows).toEqual([
      ['short', '', '', ''],
      ['one', 'extra', 'cells', 'more'],
    ]);
  });

  it('skips blank lines and names empty header cells', () => {
    const table = parseDelimited('id,\n\n1,a\n\n', ',');

    expect(table.header).toEqual(['id', 'Column 2']);
    expect(table.rows).toEqual([['1', 'a']]);
  });

  it('bounds the number of rows kept and reports the total', () => {
    const lines = ['n', ...Array.from({ length: MAX_TABLE_ROWS + 10 }, (_, i) => String(i))];
    const table = parseDelimited(lines.join('\n'), ',');

    expect(table.rows).toHaveLength(MAX_TABLE_ROWS);
    expect(table.totalRows).toBe(MAX_TABLE_ROWS + 10);
    expect(table.truncated).toBe(true);
  });
});

describe('sortRows and filterRows', () => {
  const rows = [
    ['b', '10'],
    ['a', '9'],
    ['C', '100'],
  ];

  it('sorts by one column in natural, case-insensitive order without mutating input', () => {
    expect(sortRows(rows, 1, 'asc').map((row) => row[1])).toEqual(['9', '10', '100']);
    expect(sortRows(rows, 0, 'desc').map((row) => row[0])).toEqual(['C', 'b', 'a']);
    expect(rows[0]).toEqual(['b', '10']);
  });

  it('filters rows by a case-insensitive match in any cell', () => {
    expect(filterRows(rows, ' c ')).toEqual([['C', '100']]);
    expect(filterRows(rows, '')).toEqual(rows);
  });
});
