/**
 * Arrange timetable slots into a weekday grid.
 *
 * Odoo stores one row per period with a float start and end time, in no
 * particular shape — a school may run different period lengths on different
 * days, and nothing guarantees every day shares a row. Keying the rows on the
 * exact (start, end) pair keeps irregular timetables honest: a period that
 * only exists on two days gets a row with two filled cells, rather than being
 * forced into a slot it does not belong to.
 */
export interface Slot {
  id: number
  day: string
  start: number
  end: number
}

export interface GridRow<T extends Slot> {
  start: number
  end: number
  /** Day code → the slots in this period. Usually one, but Odoo permits more. */
  cells: Record<string, T[]>
}

export interface Grid<T extends Slot> {
  /** Day codes that actually have a slot, in week order. */
  days: string[]
  rows: GridRow<T>[]
}

export function buildScheduleGrid<T extends Slot>(slots: T[], dayOrder: string[]): Grid<T> {
  const byPeriod = new Map<string, GridRow<T>>()
  const seenDays = new Set<string>()

  for (const slot of slots) {
    seenDays.add(slot.day)
    const key = `${slot.start}-${slot.end}`
    let row = byPeriod.get(key)
    if (!row) {
      row = { start: slot.start, end: slot.end, cells: {} }
      byPeriod.set(key, row)
    }
    ;(row.cells[slot.day] ??= []).push(slot)
  }

  return {
    days: dayOrder.filter((day) => seenDays.has(day)),
    rows: [...byPeriod.values()].sort((a, b) => a.start - b.start || a.end - b.end),
  }
}
