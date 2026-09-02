/** Run: node scripts/test-attendance-diff.mjs */
import assert from 'node:assert/strict'
import { changedStatuses } from '../lib/attendance-diff.ts'

function register(rows) {
  const form = new FormData()
  for (const [id, was, now] of rows) {
    form.set(`was-status-${id}`, was)
    form.set(`status-${id}`, now)
  }
  return form
}

assert.deepEqual(changedStatuses(register([[1, 'present', 'present']]), [1]), [], 'untouched row must not write')

assert.deepEqual(
  changedStatuses(register([[2, 'present', 'absent']]), [2]),
  [{ id: 2, status: 'absent' }],
  'a changed status is written',
)

// A row that never got a status is "not taken", not a write of empty.
assert.deepEqual(changedStatuses(register([[3, 'present', '']]), [3]), [], 'blank writes nothing')

// A first-time entry on a blank row still counts.
assert.deepEqual(
  changedStatuses(register([[4, '', 'late']]), [4]),
  [{ id: 4, status: 'late' }],
  'first entry on a blank row is written',
)

// A class where one student moved costs exactly one write.
const many = register([[10, 'present', 'present'], [11, 'present', 'absent'], [12, 'present', 'present']])
assert.deepEqual(changedStatuses(many, [10, 11, 12]), [{ id: 11, status: 'absent' }])

// Ids the caller did not list are ignored even if present in the form.
assert.deepEqual(changedStatuses(many, [10, 12]), [])

console.log('ok — attendance diff writes only what moved')
