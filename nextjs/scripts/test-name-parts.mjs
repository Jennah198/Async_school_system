/** Run: node scripts/test-name-parts.mjs */
import assert from 'node:assert/strict'
import { joinFullName, splitFullName } from '../lib/name-parts.ts'

const roundTrips = [
  'Abebe',
  'Abebe Kebede',
  'Abebe Kebede Tesfaye',
  'Abebe Kebede Tesfaye Bekele',
]

for (const name of roundTrips) {
  assert.equal(joinFullName(splitFullName(name)), name, `${name} must survive the round trip`)
}

assert.deepEqual(splitFullName('Abebe Kebede Tesfaye'), {
  first: 'Abebe',
  middle: 'Kebede',
  last: 'Tesfaye',
})

assert.deepEqual(splitFullName('Abebe Kebede'), { first: 'Abebe', middle: '', last: 'Kebede' })
assert.deepEqual(splitFullName('Abebe'), { first: 'Abebe', middle: '', last: '' })
assert.deepEqual(splitFullName('   '), { first: '', middle: '', last: '' })
assert.deepEqual(splitFullName('  Abebe   Kebede  '), {
  first: 'Abebe',
  middle: '',
  last: 'Kebede',
}, 'runs of whitespace must not become empty parts')

assert.equal(joinFullName({ first: ' Abebe ', middle: '', last: ' Kebede ' }), 'Abebe Kebede')
assert.equal(joinFullName({ first: '', middle: '', last: '' }), '')

console.log('name-parts: ok')

// --- editableNameParts -------------------------------------------------

const { editableNameParts } = await import('../lib/name-parts.ts')

// Parts that already agree with the name are kept verbatim.
const agreeing = { first: 'Abebe', middle: 'Kebede', last: 'Tesfaye' }
assert.deepEqual(editableNameParts('Abebe Kebede Tesfaye', agreeing), agreeing)

// The shape the demo seed leaves behind: a full name, partial parts. Trusting
// the parts here would shorten the name on the first save.
assert.deepEqual(
  editableNameParts('SRS Demo Abel Kebede', { first: 'SRS', middle: '', last: 'Kebede' }),
  { first: 'SRS', middle: 'Demo Abel', last: 'Kebede' },
)

// Registration writes the name and no parts at all.
assert.deepEqual(
  editableNameParts('Abebe Kebede Tesfaye', { first: '', middle: '', last: '' }),
  { first: 'Abebe', middle: 'Kebede', last: 'Tesfaye' },
)

for (const [name, stored] of [
  ['SRS Demo Abel Kebede', { first: 'SRS', middle: '', last: 'Kebede' }],
  ['Abebe Kebede Tesfaye', { first: '', middle: '', last: '' }],
  ['Abebe', { first: 'Wrong', middle: '', last: '' }],
]) {
  assert.equal(
    joinFullName(editableNameParts(name, stored)),
    name,
    `${name} must survive an edit that changes nothing`,
  )
}

console.log('editable-name-parts: ok')
