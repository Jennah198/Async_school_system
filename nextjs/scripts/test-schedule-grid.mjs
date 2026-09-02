/** Run: node scripts/test-schedule-grid.mjs */
import assert from 'node:assert/strict'
import { buildScheduleGrid } from '../lib/schedule-grid.ts'

const DAYS = ['0', '1', '2', '3', '4', '5', '6']
const slot = (id, day, start, end) => ({ id, day, start, end })

const week = [
  slot(3, '1', 8, 8.75),
  slot(1, '0', 8, 8.75),
  slot(2, '0', 9, 9.75),
  slot(4, '1', 9, 9.75),
]
const grid = buildScheduleGrid(week, DAYS)

assert.deepEqual(grid.days, ['0', '1'], 'only days with a slot appear')
assert.equal(grid.rows.length, 2, 'two distinct periods')
assert.deepEqual(
  grid.rows.map((r) => r.start),
  [8, 9],
  'rows are ordered by start time regardless of input order',
)
assert.deepEqual(grid.rows[0].cells['0'].map((s) => s.id), [1])
assert.deepEqual(grid.rows[0].cells['1'].map((s) => s.id), [3])

// A period that exists on one day only must not pull other days into its row.
const irregular = buildScheduleGrid([slot(1, '0', 8, 8.75), slot(2, '4', 13, 14)], DAYS)
assert.equal(irregular.rows.length, 2, 'unshared periods each get their own row')
assert.deepEqual(irregular.days, ['0', '4'])
assert.equal(irregular.rows[1].cells['0'], undefined, 'no phantom cell')

// Same start, different end is a different period, not the same one.
const differentEnds = buildScheduleGrid([slot(1, '0', 8, 8.75), slot(2, '1', 8, 9.5)], DAYS)
assert.equal(differentEnds.rows.length, 2, 'end time is part of the period identity')

// Odoo permits two rows in one cell; both must survive.
const doubled = buildScheduleGrid([slot(1, '0', 8, 9), slot(2, '0', 8, 9)], DAYS)
assert.equal(doubled.rows.length, 1)
assert.deepEqual(doubled.rows[0].cells['0'].map((s) => s.id), [1, 2], 'a clash is shown, not hidden')

assert.deepEqual(buildScheduleGrid([], DAYS), { days: [], rows: [] })

console.log('schedule-grid: ok')
