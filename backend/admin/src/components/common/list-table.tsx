import { Table, Text, clx } from '@medusajs/ui';
import type { ReactNode } from 'react';

export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };

/** A list with its pagination, as Medusa's data tables; a click on a row opens it. */
export function ListTable<T extends { id: string }>({
  columns,
  rows,
  count,
  pageSize,
  pageIndex,
  onPageChange,
  onRowClick,
  empty,
  loading,
}: {
  columns: Column<T>[];
  rows: T[];
  count: number;
  pageSize: number;
  pageIndex: number;
  onPageChange: (index: number) => void;
  onRowClick?: (row: T) => void;
  empty: string;
  loading?: boolean;
}) {
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div>
      <Table>
        <Table.Header>
          <Table.Row>
            {columns.map((c) => (
              <Table.HeaderCell key={c.key} className={c.className}>
                {c.header}
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.id} className={clx(onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(row)}>
              {columns.map((c) => (
                <Table.Cell key={c.key} className={c.className}>
                  {c.render(row)}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!rows.length && (
        <div className="flex h-[150px] items-center justify-center border-b">
          <Text size="small" className="text-ui-fg-muted">
            {loading ? 'Chargement…' : empty}
          </Text>
        </div>
      )}
      <Table.Pagination
        count={count}
        pageSize={pageSize}
        pageIndex={pageIndex}
        pageCount={pageCount}
        canPreviousPage={pageIndex > 0}
        canNextPage={pageIndex + 1 < pageCount}
        previousPage={() => onPageChange(pageIndex - 1)}
        nextPage={() => onPageChange(pageIndex + 1)}
        translations={{ of: 'sur', results: 'résultats', pages: 'pages', prev: 'Précédent', next: 'Suivant' }}
      />
    </div>
  );
}
