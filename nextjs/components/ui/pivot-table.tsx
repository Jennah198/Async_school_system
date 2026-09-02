import { buildPivot, readCell, type GroupedRow } from '@/lib/pivot'

/**
 * A cross-tab with totals down both edges.
 *
 * `average` is per table rather than global because the two pivots in this
 * addon measure different things: attendance counts rows, so its cells sum;
 * marks measure a percentage, which only means anything averaged.
 *
 * An absent combination renders as a dash, never a zero -- "no marks recorded"
 * and "an average of zero" are not the same statement.
 */
export function PivotTable({
  rows,
  rowHeaders,
  columnHeader,
  average = false,
  suffix = '',
  emptyLabel = 'Nothing to show yet.',
}: {
  rows: GroupedRow[]
  /** One header per row-axis level, outermost first. */
  rowHeaders: string[]
  columnHeader: string
  average?: boolean
  suffix?: string
  emptyLabel?: string
}) {
  const pivot = buildPivot(rows)

  if (pivot.rows.length === 0) {
    return <p className="px-6 pb-6 text-[13px] text-slate">{emptyLabel}</p>
  }

  const show = (value: number | null) =>
    value === null ? '\u2014' : `${Math.round(value * 10) / 10}${suffix}`

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-silver bg-paper text-left">
            {rowHeaders.map((header) => (
              <th key={header} className="px-4 py-2.5 font-medium text-slate">
                {header}
              </th>
            ))}
            {pivot.columns.map((column) => (
              <th key={column} className="px-4 py-2.5 text-right font-medium text-slate">
                {column}
              </th>
            ))}
            <th className="px-4 py-2.5 text-right font-medium text-graphite">
              {columnHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {pivot.rows.map((row) => (
            <tr key={row.key.join(' / ')} className="border-b border-silver">
              {row.key.map((part, index) => (
                <th
                  key={`${part}-${index}`}
                  scope="row"
                  className="px-4 py-2.5 text-left font-normal text-graphite"
                >
                  {part}
                </th>
              ))}
              {/* A row missing an inner level still fills the header columns. */}
              {row.key.length < rowHeaders.length
                ? Array.from({ length: rowHeaders.length - row.key.length }, (_, index) => (
                    <td key={`pad-${index}`} className="px-4 py-2.5 text-stone">
                      {'\u2014'}
                    </td>
                  ))
                : null}
              {pivot.columns.map((column) => (
                <td key={column} className="px-4 py-2.5 text-right tabular text-graphite">
                  {show(readCell(row.cells.get(column), average))}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-medium tabular text-graphite">
                {show(readCell(row.total, average))}
              </td>
            </tr>
          ))}
          <tr className="border-b border-silver bg-paper">
            <th
              scope="row"
              colSpan={rowHeaders.length}
              className="px-4 py-2.5 text-left font-medium text-graphite"
            >
              All
            </th>
            {pivot.columns.map((column) => (
              <td key={column} className="px-4 py-2.5 text-right font-medium tabular text-graphite">
                {show(readCell(pivot.columnTotals.get(column), average))}
              </td>
            ))}
            <td className="px-4 py-2.5 text-right font-medium tabular text-graphite">
              {show(readCell(pivot.grandTotal, average))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
