/**
 * Checks lib/ethiopian-date.ts against the platform's own ethiopic calendar
 * over every day of a 40-year span, and round-trips each one back.
 *
 * Intl is the oracle here, not the implementation — the app cannot use it at
 * render time without risking a hydration mismatch. Run: node scripts/test-ethiopian-date.mjs
 */
import assert from 'node:assert/strict'
import {
  daysInEthiopianMonth,
  ethiopianWeekday,
  ETHIOPIAN_MONTHS,
  isoToEthiopianLabel,
  ethiopianYearOf,
  toEthiopian,
  toGregorian,
} from '../lib/ethiopian-date.ts'

const parts = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function intlEthiopian(date) {
  const found = {}
  for (const part of parts.formatToParts(date)) found[part.type] = Number(part.value)
  return { year: found.year, month: found.month, day: found.day }
}

let checked = 0
for (
  let time = Date.UTC(2000, 0, 1);
  time <= Date.UTC(2040, 0, 1);
  time += 86400000
) {
  const date = new Date(time)
  const gregorian = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }

  const mine = toEthiopian(gregorian)
  assert.deepEqual(mine, intlEthiopian(date), `conversion diverged on ${date.toISOString()}`)
  assert.deepEqual(toGregorian(mine), gregorian, `round trip failed on ${date.toISOString()}`)
  assert.ok(mine.day <= daysInEthiopianMonth(mine.year, mine.month), `day past month end on ${date.toISOString()}`)

  // JavaScript weeks start on Sunday; ours starts on Segno (Monday).
  assert.equal(ethiopianWeekday(mine), (date.getUTCDay() + 6) % 7, `weekday drifted on ${date.toISOString()}`)
  checked += 1
}

// Ethiopian new year 2019 falls on 11 September 2026.
assert.equal(isoToEthiopianLabel('2026-09-11'), 'Meskerem 1, 2019')
assert.equal(isoToEthiopianLabel('2026-09-10'), 'Pagume 5, 2018')
assert.equal(isoToEthiopianLabel('not a date'), null)

// The academic year Odoo seeds from 1 September 2026 is named 2018.
assert.equal(ethiopianYearOf('2026-09-01'), 2018)
assert.equal(ETHIOPIAN_MONTHS.length, 13)

// Pagume takes a sixth day when the Ethiopian year mod 4 is 3.
assert.equal(daysInEthiopianMonth(2018, 13), 5)
assert.equal(daysInEthiopianMonth(2019, 13), 6)
assert.equal(daysInEthiopianMonth(2019, 1), 30)

console.log(`ok — ${checked} days match Intl's ethiopic calendar and round trip`)
