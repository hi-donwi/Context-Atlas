interface DelimitedTableProps {
    readonly content: string;
    readonly delimiter: ',' | '\t';
    /** Accessible name for the table, such as the file name. */
    readonly label: string;
}
/** A read-only table for CSV or TSV text with sorting, filtering, and a row count. */
export declare function DelimitedTable({ content, delimiter, label }: DelimitedTableProps): import("react").JSX.Element;
export {};
