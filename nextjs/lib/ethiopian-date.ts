/**
 * Gregorian ⇄ Ethiopian (Amete Mihret) calendar conversion.
 *
 * Odoo stores every date as Gregorian and validates academic-year names
 * against the Ethiopian year with the `ethiopian_date` Python package. This is
 * the same conversion for the browser side.
 *
 * It is integer arithmetic rather than `Intl.DateTimeFormat('en-u-ca-ethiopic')`
 * on purpose. `lib/format.ts` renders in both server and client components, and
 * a locale-dependent formatter resolves against whatever ICU data each side
 * carries — which is exactly the hydration mismatch that file already avoids.
 * The arithmetic is identical on every engine.
 */

export const ETHIOPIAN_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
] as const

/** Monday first, matching Odoo's `day_of_week` and `WEEKDAY_NAMES`. */
export const ETHIOPIAN_WEEKDAYS = [
  'Segno',
  'Maksegno',
  'Rob',
  'Hamus',
  'Arb',
  'Kidame',
  'Ehud',
] as const

export interface EthiopianDate {
  year: number
  month: number
  day: number
}

export interface GregorianDate {
  year: number
  month: number
  day: number
}

/** Julian Day Number of Meskerem 1, 1 Amete Mihret. */
const ETHIOPIC_EPOCH = 1723856

/** `%` keeps the sign of the dividend; calendar arithmetic needs it dropped. */
function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

function jdnToGregorian(jdn: number): GregorianDate {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  }
}

export function toEthiopian({ year, month, day }: GregorianDate): EthiopianDate {
  const offset = gregorianToJdn(year, month, day) - ETHIOPIC_EPOCH
  const rest = mod(offset, 1461)
  const dayOfYear = mod(rest, 365) + 365 * Math.floor(rest / 1460)
  return {
    year: 4 * Math.floor(offset / 1461) + Math.floor(rest / 365) - Math.floor(rest / 1460),
    month: Math.floor(dayOfYear / 30) + 1,
    day: mod(dayOfYear, 30) + 1,
  }
}

export function toGregorian({ year, month, day }: EthiopianDate): GregorianDate {
  return jdnToGregorian(
    ETHIOPIC_EPOCH +
      365 * year +
      Math.floor(year / 4) +
      30 * (month - 1) +
      day -
      1,
  )
}

/** Pagume is the thirteenth month: five days, six in a leap year. */
export function isEthiopianLeapYear(year: number): boolean {
  return mod(year, 4) === 3
}

export function daysInEthiopianMonth(year: number, month: number): number {
  if (month < 13) return 30
  return isEthiopianLeapYear(year) ? 6 : 5
}

/** 0 is Segno (Monday), matching `ETHIOPIAN_WEEKDAYS`. */
export function ethiopianWeekday(date: EthiopianDate): number {
  const { year, month, day } = toGregorian(date)
  return mod(gregorianToJdn(year, month, day), 7)
}

/* --------------------------------------------------------- ISO helpers --- */

/** Odoo's wire format, `YYYY-MM-DD`, with no timezone shift. */
export function parseIsoDate(value: string): GregorianDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function toIsoDate({ year, month, day }: GregorianDate): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/** `2026-09-11` → `Meskerem 1, 2019`. Returns null when unparseable. */
export function isoToEthiopianLabel(value: string): string | null {
  const gregorian = parseIsoDate(value)
  if (!gregorian) return null
  const { year, month, day } = toEthiopian(gregorian)
  return `${ETHIOPIAN_MONTHS[month - 1]} ${day}, ${year}`
}

/** The Ethiopian year an ISO date falls in — what an academic year is named. */
export function ethiopianYearOf(value: string): number | null {
  const gregorian = parseIsoDate(value)
  return gregorian ? toEthiopian(gregorian).year : null
}
