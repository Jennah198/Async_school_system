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
