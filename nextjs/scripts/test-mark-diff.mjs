/** Run: node scripts/test-mark-diff.mjs */
import assert from 'node:assert/strict'
import { changedRows } from '../lib/mark-diff.ts'

function rowForm(id, was, now) {
  const form = new FormData()
  form.append('markId', String(id))
  form.set(`was-score-${id}`, was.score)
  form.set(`was-status-${id}`, was.status)
  form.set(`was-note-${id}`, was.note)
  form.set(`score-${id}`, now.score)
  form.set(`status-${id}`, now.status)
  form.set(`note-${id}`, now.note)
  return form
}

const untouched = { score: '12', status: 'recorded', note: 'ok' }

assert.deepEqual(changedRows(rowForm(1, untouched, untouched), [1]), [], 'untouched row must not write')

assert.deepEqual(
  changedRows(rowForm(2, untouched, { ...untouched, score: '15' }), [2]),
  [{ markId: 2, values: { score: 15 } }],
  'a changed score writes only the score',
)

// Zero is a real score, not an absence.
assert.deepEqual(
  changedRows(rowForm(3, untouched, { ...untouched, score: '0' }), [3]),
  [{ markId: 3, values: { score: 0 } }],
  'zero must be written',
)

// Clearing the box means "not entered", not "erase the recorded score".
assert.deepEqual(
  changedRows(rowForm(4, untouched, { ...untouched, score: '' }), [4]),
  [],
  'a blank score writes nothing',
)

assert.deepEqual(
  changedRows(rowForm(5, untouched, { ...untouched, note: '' }), [5]),
  [{ markId: 5, values: { note: '' } }],
  'a remark can be cleared',
)

assert.deepEqual(
  changedRows(rowForm(6, untouched, { score: '9', status: 'absent', note: 'sick' }), [6]),
  [{ markId: 6, values: { score: 9, mark_status: 'absent', note: 'sick' } }],
  'every changed field travels together',
)

// A roster where one row moved must cost exactly one write.
const roster = new FormData()
for (const id of [10, 11, 12]) {
  roster.append('markId', String(id))
  roster.set(`was-score-${id}`, '5')
  roster.set(`was-status-${id}`, 'recorded')
  roster.set(`was-note-${id}`, '')
  roster.set(`score-${id}`, id === 11 ? '7' : '5')
  roster.set(`status-${id}`, 'recorded')
  roster.set(`note-${id}`, '')
}
assert.deepEqual(changedRows(roster, [10, 11, 12]), [{ markId: 11, values: { score: 7 } }])

console.log('ok — mark diff writes only what moved')
