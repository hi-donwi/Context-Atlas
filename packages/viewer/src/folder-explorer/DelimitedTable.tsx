import { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { filterRows, parseDelimited, sortRows, type SortDirection } from './delimited.js';
import { formatFolderMessage, useFolderLocale, useFolderMessages } from './locale.js';

interface DelimitedTableProps {
  readonly content: string;
  readonly delimiter: ',' | '\t';
  /** Accessible name for the table, such as the file name. */
  readonly label: string;
}

interface SortState {
  readonly column: number;
  readonly direction: SortDirection;
}

/** A read-only table for CSV or TSV text with sorting, filtering, and a row count. */
export function DelimitedTable({ content, delimiter, label }: DelimitedTableProps) {
  const text = useFolderMessages();
  const locale = useFolderLocale();
  const filterId = useId();
  const table = useMemo(() => parseDelimited(content, delimiter), [content, delimiter]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const visibleRows = useMemo(() => {
    const filtered = filterRows(table.rows, query);
    return sort === null ? filtered : sortRows(filtered, sort.column, sort.direction);
  }, [query, sort, table.rows]);

  if (table.header.length === 0) {
    return (
      <p className="atlas-table__empty" lang={locale}>
        {text.emptyTable}
      </p>
    );
  }

  const toggleSort = (column: number) =>
    setSort((current) =>
      current?.column !== column
        ? { column, direction: 'asc' }
        : current.direction === 'asc'
          ? { column, direction: 'desc' }
          : null,
    );

  return (
    <section className="atlas-table" aria-label={label}>
      <div className="atlas-table__controls" lang={locale}>
        <label className="atlas-table__filter" htmlFor={filterId}>
          <span>{text.filter}</span>
          <input
            id={filterId}
            type="search"
            aria-label={text.filterRows}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p className="atlas-table__count" role="status" aria-live="polite">
          {formatFolderMessage(text.rowCount, {
            visible: visibleRows.length.toLocaleString(),
            total: table.rows.length.toLocaleString(),
          })}
          {table.truncated
            ? formatFolderMessage(text.rowLimit, {
                shown: table.rows.length.toLocaleString(),
                total: table.totalRows.toLocaleString(),
              })
            : ''}
        </p>
      </div>
      <div
        className="atlas-table__scroll"
        tabIndex={0}
        aria-label={formatFolderMessage(text.scrollable, { name: label })}
      >
        <table>
          <thead>
            <tr>
              {table.header.map((name, column) => {
                const active = sort?.column === column ? sort.direction : undefined;
                const Icon =
                  active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={`${column}-${name}`}
                    scope="col"
                    aria-sort={
                      active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      lang={locale}
                      aria-label={formatFolderMessage(text.sortBy, { name })}
                    >
                      <span>{name}</span>
                      <Icon size={14} aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, column) => (
                  <td key={column}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
