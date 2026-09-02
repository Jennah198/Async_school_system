/**
 * Arrange grouped rows into a cross-tab.
 *
 * Odoo's `read_group` returns one flat row per combination of the groupby
 * fields. A pivot needs those laid out as rows by columns with totals down
 * both edges, which is the whole difference between "the data is there" and
 * "someone can read it".
 *
 * Row keys stay a tuple so a pivot can nest -- class then subject, as
 * `school.mark.pivot` does -- without a second pass.
 */
export interface GroupedRow {
  /** Ordered row-axis labels, outermost first. */
  rowKey: string[]
  /** Column-axis label. */
  colKey: string
  value: number
  /** Rows behind the value, for averaging. */
  count: number
}

export interface PivotCell {
  value: number
  count: number
}

export interface PivotRow {
  key: string[]
  cells: Map<string, PivotCell>
  total: PivotCell
}

export interface Pivot {
  columns: string[]
  rows: PivotRow[]
  columnTotals: Map<string, PivotCell>
  grandTotal: PivotCell
}

const add = (a: PivotCell | undefined, b: PivotCell): PivotCell => ({
  value: (a?.value ?? 0) + b.value,
  count: (a?.count ?? 0) + b.count,
})

/** Labels may contain spaces, so rows are keyed on a separator they cannot. */
const SEPARATOR = "\u0000"

export function buildPivot(rows: GroupedRow[]): Pivot {
  const columns: string[] = []
  const byRow = new Map<string, PivotRow>()
  const columnTotals = new Map<string, PivotCell>()
  let grandTotal: PivotCell = { value: 0, count: 0 }

  for (const row of rows) {
    if (!columns.includes(row.colKey)) columns.push(row.colKey)

    const id = row.rowKey.join(SEPARATOR)
    let target = byRow.get(id)
    if (!target) {
      target = { key: row.rowKey, cells: new Map(), total: { value: 0, count: 0 } }
      byRow.set(id, target)
    }

    const cell = { value: row.value, count: row.count }
    target.cells.set(row.colKey, add(target.cells.get(row.colKey), cell))
    target.total = add(target.total, cell)
    columnTotals.set(row.colKey, add(columnTotals.get(row.colKey), cell))
    grandTotal = add(grandTotal, cell)
  }

  return { columns, rows: [...byRow.values()], columnTotals, grandTotal }
}

/**
 * A cell's displayed number.
 *
 * Counting is a sum of rows; a percentage is only meaningful averaged over the
 * rows behind it, which is why the count travels alongside the value.
 */
export function readCell(cell: PivotCell | undefined, average: boolean): number | null {
  if (!cell || cell.count === 0) return null
  return average ? cell.value / cell.count : cell.value
}
