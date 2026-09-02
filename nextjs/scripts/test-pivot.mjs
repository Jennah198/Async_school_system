/** Run: node scripts/test-pivot.mjs */
import assert from 'node:assert/strict'
import { buildPivot, readCell } from '../lib/pivot.ts'

const row = (rowKey, colKey, value, count = 1) => ({ rowKey, colKey, value, count })

const pivot = buildPivot([
  row(['Grade 9'], 'Term 1', 80, 2),
  row(['Grade 9'], 'Term 2', 90, 2),
  row(['Grade 10'], 'Term 1', 70, 1),
])

assert.deepEqual(pivot.columns, ['Term 1', 'Term 2'], 'columns appear in first-seen order')
assert.equal(pivot.rows.length, 2)
assert.deepEqual(pivot.rows[0].key, ['Grade 9'])

// Totals down both edges and the corner.
assert.deepEqual(pivot.rows[0].total, { value: 170, count: 4 })
assert.deepEqual(pivot.columnTotals.get('Term 1'), { value: 150, count: 3 })
assert.deepEqual(pivot.grandTotal, { value: 240, count: 5 })

// A missing combination is absent, not zero -- Grade 10 has no Term 2.
assert.equal(pivot.rows[1].cells.get('Term 2'), undefined)
assert.equal(readCell(pivot.rows[1].cells.get('Term 2'), false), null)

// Summing versus averaging is the difference between periods and percentages.
assert.equal(readCell(pivot.rows[0].cells.get('Term 1'), false), 80)
assert.equal(readCell(pivot.rows[0].cells.get('Term 1'), true), 40)
assert.equal(readCell(pivot.grandTotal, true), 48)

// Nested row keys must not collide with each other.
const nested = buildPivot([
  row(['Grade 9', 'Maths'], 'Term 1', 10),
  row(['Grade 9', 'Science'], 'Term 1', 20),
  row(['Grade 9', 'Maths'], 'Term 2', 30),
])
assert.equal(nested.rows.length, 2, 'class and subject pairs are distinct rows')
assert.deepEqual(nested.rows[0].key, ['Grade 9', 'Maths'])
assert.deepEqual(nested.rows[0].total, { value: 40, count: 2 })

// Repeated combinations accumulate rather than overwrite.
const repeated = buildPivot([row(['A'], 'X', 5), row(['A'], 'X', 7)])
assert.deepEqual(repeated.rows[0].cells.get('X'), { value: 12, count: 2 })

// Labels containing the obvious join character must still separate rows.
const tricky = buildPivot([row(['a', 'b'], 'X', 1), row(['a b'], 'X', 2)])
assert.equal(tricky.rows.length, 2, 'row keys join on a character labels cannot contain')

const empty = buildPivot([])
assert.deepEqual(empty.columns, [])
assert.deepEqual(empty.rows, [])
assert.deepEqual(empty.grandTotal, { value: 0, count: 0 })

console.log('pivot: ok')
