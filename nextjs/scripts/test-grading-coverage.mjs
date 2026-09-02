/** Run: node scripts/test-grading-coverage.mjs */
import assert from 'node:assert/strict'
import { coverageGap, overlappingBands } from '../lib/grading-coverage.ts'

const band = (minimum_percentage, maximum_percentage) => ({
  minimum_percentage,
  maximum_percentage,
})

/** The scale the demo seed installs, and what Odoo accepts. */
const seeded = [
  band(90, 100), band(80, 89.99), band(70, 79.99),
  band(60, 69.99), band(50, 59.99), band(0, 49.99),
]

assert.equal(coverageGap(seeded), null, 'the seeded scale must pass')
assert.equal(overlappingBands(seeded), null, 'the seeded scale must not overlap')

// Exactly-touching bands are the other accepted shape.
assert.equal(coverageGap([band(0, 50), band(50, 100)]), null)
assert.equal(overlappingBands([band(0, 50), band(50, 100)]), null, 'touching is not overlapping')

assert.equal(coverageGap([]), 'Add at least one band.')
assert.match(coverageGap([band(1, 100)]), /starts at 1, not 0/)
assert.match(coverageGap([band(0, 99)]), /ends at 99, not 100/)
assert.match(coverageGap([band(0, 40), band(60, 100)]), /between 40 and 60/)
assert.match(coverageGap([band(0, 100), band(50, 40)]), /from 50 down to 40/)

// 0.01 is inside Odoo's tolerance; 0.02 is not.
assert.equal(coverageGap([band(0, 49.99), band(50, 100)]), null)
assert.match(coverageGap([band(0, 49.98), band(50, 100)]), /between 49.98 and 50/)

assert.match(overlappingBands([band(0, 60), band(50, 100)]), /both cover 50/)

// Order of entry must not matter.
assert.equal(coverageGap([band(50, 100), band(0, 49.99)]), null)

console.log('grading-coverage: ok')
