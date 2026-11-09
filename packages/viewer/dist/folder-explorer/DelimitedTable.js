import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { filterRows, parseDelimited, sortRows } from './delimited.js';
import { formatFolderMessage, useFolderLocale, useFolderMessages } from './locale.js';
/** A read-only table for CSV or TSV text with sorting, filtering, and a row count. */
export function DelimitedTable({ content, delimiter, label }) {
    const text = useFolderMessages();
    const locale = useFolderLocale();
    const filterId = useId();
    const table = useMemo(() => parseDelimited(content, delimiter), [content, delimiter]);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState(null);
    const visibleRows = useMemo(() => {
        const filtered = filterRows(table.rows, query);
        return sort === null ? filtered : sortRows(filtered, sort.column, sort.direction);
    }, [query, sort, table.rows]);
    if (table.header.length === 0) {
        return (_jsx("p", { className: "atlas-table__empty", lang: locale, children: text.emptyTable }));
    }
    const toggleSort = (column) => setSort((current) => current?.column !== column
        ? { column, direction: 'asc' }
        : current.direction === 'asc'
            ? { column, direction: 'desc' }
            : null);
    return (_jsxs("section", { className: "atlas-table", "aria-label": label, children: [_jsxs("div", { className: "atlas-table__controls", lang: locale, children: [_jsxs("label", { className: "atlas-table__filter", htmlFor: filterId, children: [_jsx("span", { children: text.filter }), _jsx("input", { id: filterId, type: "search", "aria-label": text.filterRows, value: query, onChange: (event) => setQuery(event.target.value) })] }), _jsxs("p", { className: "atlas-table__count", role: "status", "aria-live": "polite", children: [formatFolderMessage(text.rowCount, {
                                visible: visibleRows.length.toLocaleString(),
                                total: table.rows.length.toLocaleString(),
                            }), table.truncated
                                ? formatFolderMessage(text.rowLimit, {
                                    shown: table.rows.length.toLocaleString(),
                                    total: table.totalRows.toLocaleString(),
                                })
                                : ''] })] }), _jsx("div", { className: "atlas-table__scroll", tabIndex: 0, "aria-label": formatFolderMessage(text.scrollable, { name: label }), children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: table.header.map((name, column) => {
                                    const active = sort?.column === column ? sort.direction : undefined;
                                    const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown;
                                    return (_jsx("th", { scope: "col", "aria-sort": active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none', children: _jsxs("button", { type: "button", onClick: () => toggleSort(column), lang: locale, "aria-label": formatFolderMessage(text.sortBy, { name }), children: [_jsx("span", { children: name }), _jsx(Icon, { size: 14, "aria-hidden": "true" })] }) }, `${column}-${name}`));
                                }) }) }), _jsx("tbody", { children: visibleRows.map((row, rowIndex) => (_jsx("tr", { children: row.map((cell, column) => (_jsx("td", { children: cell }, column))) }, rowIndex))) })] }) })] }));
}
