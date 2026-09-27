/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011).
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 * Replace with the owner's implementation on integration.
 */
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <table className="data-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DataTable;
