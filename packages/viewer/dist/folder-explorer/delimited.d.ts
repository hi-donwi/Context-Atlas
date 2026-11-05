/** The most data rows kept for display from one delimited file. */
export declare const MAX_TABLE_ROWS = 5000;
/** The most columns kept for display from one delimited file. */
export declare const MAX_TABLE_COLUMNS = 100;
/** A parsed CSV or TSV table: the first record is the header. */
export interface DelimitedTable {
    readonly header: string[];
    readonly rows: string[][];
    /** Data rows in the source, including any beyond the display bound. */
    readonly totalRows: number;
    readonly truncated: boolean;
}
export type SortDirection = 'asc' | 'desc';
/** Parse RFC 4180-style delimited text into a bounded header-and-rows table. */
export declare function parseDelimited(text: string, delimiter: ',' | '\t'): DelimitedTable;
/** Return rows sorted by one column in natural order; the input is not changed. */
export declare function sortRows(rows: readonly string[][], column: number, direction: SortDirection): string[][];
/** Return rows that contain the query in any cell, ignoring case and surrounding spaces. */
export declare function filterRows(rows: readonly string[][], query: string): string[][];
