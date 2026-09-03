import 'server-only'
import { callKw } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import { selectionOptions } from '@/lib/odoo/selections'
import { statusLabel } from '@/lib/status'
import type { Domain } from '@/lib/odoo/types'

/**
 * Aggregation primitives for the dashboard.
 *
 * Three rules hold for everything in this file, and they are the reason the
 * numbers on the dashboard can be trusted.
 *
 * **Odoo does the arithmetic.** Every figure comes back from
 * `formatted_read_group` — Odoo 19's grouping API — which means it is computed
 * in PostgreSQL, under the record rules of the signed-in user, over the whole
 * table. Nothing is derived by fetching rows and counting them in TypeScript.
 * A count that is right for a school of nine students and wrong for one of nine
 * hundred is not a count.
 *
 * **A refusal is null, never zero.** Roles differ enormously here: a Director
 * cannot read `school.class` at all, while a Registrar reads almost
 * everything. `null` means the role cannot see this and renders as a stated
 * boundary; `0` means Odoo looked and found nothing. Collapsing the two would
 * put a confident, wrong number in front of somebody.
 *
 * **Nothing is invented.** No interpolation, no smoothing, no projected point.
 * A series with one period in it comes back with one period in it, and the
 * caller says there is not enough history yet.
 */

/* ----------------------------------------------------------- primitives --- */

/** One bucket of a grouped aggregate. */
export interface Bucket {
  /** The raw group key — a selection code, a record id, or a date boundary. */
  value: string
  label: string
  count: number
  /** Present only when an averaged or summed field was requested. */
  measure?: number
  /** Odoo's own domain for this bucket, which is what makes drill-down exact. */
  domain?: Domain
}

/**
 * `formatted_read_group`, normalised.
 *
 * Group-by entries may carry Odoo's granularity suffix (`date:day`,
 * `registration_date:month`). `measure` names a field to average or sum, in
 * Odoo's own `field:agg` notation.
 */
async function readGroup(
  model: string,
  groupBy: string[],
  domain: Domain = [],
  measure?: string,
): Promise<Array<Record<string, unknown>> | null> {
  const aggregates = measure ? [measure, '__count'] : ['__count']
  return orNullOnRefusal(
    callKw<Array<Record<string, unknown>>>(model, 'formatted_read_group', [
      domain,
      groupBy,
      aggregates,
    ]),
  )
}

/**
 * How many records sit in each value of one field.
 *
 * Labels come from the field's own selection, or from the display name Odoo
 * returns for a many2one, so a state added to the addon appears here without a
 * change on this side.
 */
export async function groupBy(
  model: string,
  field: string,
  options: { domain?: Domain; measure?: string; keepEmpty?: boolean } = {},
): Promise<Bucket[] | null> {
  const rows = await readGroup(model, [field], options.domain ?? [], options.measure)
  if (!rows) return null

  // Only a plain selection field needs labels looked up; a granularity suffix
  // and a many2one both carry their label in the response.
  const plain = !field.includes(':')
  const labels = plain
    ? new Map((await selectionOptions(model, field)).map((option) => [option.value, option.label]))
    : new Map<string, string>()

  const buckets = rows.map((row) => {
    const raw = row[field]
    /*
      Three shapes arrive under the same key: `[id, name]` for a many2one,
      `[boundary, label]` for a date granularity, the bare code for a
      selection — and `false` wherever the field is simply unset.
    */
    const value = Array.isArray(raw) ? String(raw[0]) : raw === false ? '' : String(raw ?? '')
    const label = Array.isArray(raw)
      ? String(raw[1])
      : raw === false
        ? 'Unspecified'
        : (labels.get(value) ?? statusLabel(value))
    const measured = options.measure ? row[options.measure] : undefined
    return {
      value,
      label,
      count: Number(row.__count ?? 0),
      ...(typeof measured === 'number' ? { measure: measured } : {}),
      domain: (row.__extra_domain as Domain) ?? undefined,
    }
  })

  return options.keepEmpty ? buckets : buckets.filter((bucket) => bucket.count > 0)
}

/**
 * A single aggregate over the whole rule-filtered table.
 *
 * Null both when the role cannot read the model and when there is nothing to
 * average — the average of no marks is not zero, it is nothing.
 */
export async function aggregate(
  model: string,
  measure: string,
  domain: Domain = [],
): Promise<{ value: number; count: number } | null> {
  const rows = await readGroup(model, [], domain, measure)
  if (!rows || rows.length === 0) return null
  const count = Number(rows[0].__count ?? 0)
  const value = rows[0][measure]
  if (count === 0 || typeof value !== 'number') return null
  return { value, count }
}

/* --------------------------------------------------------------- series --- */

export interface Series {
  points: Array<{ label: string; value: number; iso: string }>
  /** False when there are too few periods to read as a trend. */
  meaningful: boolean
}

/**
 * A count per period, oldest first.
 *
 * Odoo returns only the periods that hold records, so the gaps are real gaps
 * rather than zeroes — a day on which no register was taken is not a day on
 * which nobody was present. Nothing is filled in here.
 *
 * `meaningful` is false below two periods: a single point is a number, not a
 * trend, and drawing it as a line implies a direction nobody measured.
 */
export async function series(
  model: string,
  field: string,
  granularity: 'day' | 'week' | 'month',
  options: { domain?: Domain; measure?: string; limit?: number } = {},
): Promise<Series | null> {
  const buckets = await groupBy(model, `${field}:${granularity}`, {
    domain: options.domain,
    measure: options.measure,
  })
  if (!buckets) return null

  const points = buckets
    .map((bucket) => ({
      iso: bucket.value,
      label: bucket.label,
      value: options.measure ? (bucket.measure ?? 0) : bucket.count,
    }))
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .slice(-(options.limit ?? 12))

  return { points, meaningful: points.length >= 2 }
}

/* ------------------------------------------------------------- cross-tab --- */

export interface CrossTabPeriod {
  iso: string
  label: string
  total: number
  /** Count per value of the second field, for the periods that have one. */
  by: Record<string, number>
}

/**
 * A count grouped by a date period *and* a second field.
 *
 * Attendance is the case this exists for: "present today" is a share, and a
 * share needs both the numerator and the denominator to come from the same
 * grouped query. Asking for the two counts separately would let them be
 * computed over different record sets whenever a rule or a domain differed
 * even slightly, and the percentage would be quietly wrong.
 *
 * Odoo groups on both fields in one pass; the periods are assembled here.
 */
export async function crossTab(
  model: string,
  dateField: string,
  granularity: 'day' | 'week' | 'month',
  field: string,
  options: { domain?: Domain; limit?: number } = {},
): Promise<CrossTabPeriod[] | null> {
  const key = `${dateField}:${granularity}`
  const rows = await readGroup(model, [key, field], options.domain ?? [])
  if (!rows) return null

  const periods = new Map<string, CrossTabPeriod>()
  for (const row of rows) {
    const raw = row[key]
    if (!Array.isArray(raw)) continue
    const iso = String(raw[0])
    const period = periods.get(iso) ?? { iso, label: String(raw[1]), total: 0, by: {} }
    const bucket = row[field]
    const code = Array.isArray(bucket) ? String(bucket[0]) : String(bucket ?? '')
    const count = Number(row.__count ?? 0)
    period.by[code] = (period.by[code] ?? 0) + count
    period.total += count
    periods.set(iso, period)
  }

  return [...periods.values()]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .slice(-(options.limit ?? 14))
}

/* -------------------------------------------------------------- roll-up --- */

export interface Parent {
  id: number
  key: string
  label: string
  sequence: number
}

/**
 * Re-key one model's grouped counts by a field on the *related* model.
 *
 * Students carry `class_id`, not a grade — the grade hangs off the class, and
 * `class_grade_level` is a non-stored related field, so Odoo cannot group by
 * it. Asking it to would either fail or quietly read every student row.
 *
 * One grouped count on the child and one read of the parents that actually
 * appeared, joined here. Two queries whatever the size of the school, and both
 * of them still Odoo's own.
 */
export function rollUp(buckets: Bucket[], parents: Parent[]): Bucket[] {
  const byId = new Map(parents.map((parent) => [String(parent.id), parent]))
  const totals = new Map<string, { label: string; count: number; sequence: number }>()

  for (const bucket of buckets) {
    /*
      A child whose parent is unset, or whose parent this role cannot read,
      is held under its own heading rather than dropped. The bars have to
      still add up to the number in the tile above them.
    */
    const parent = byId.get(bucket.value)
    const key = parent?.key ?? ''
    const running = totals.get(key)
    if (running) {
      running.count += bucket.count
    } else {
      totals.set(key, {
        label: parent?.label ?? 'Unassigned',
        count: bucket.count,
        sequence: parent?.sequence ?? Number.MAX_SAFE_INTEGER,
      })
    }
  }

  return [...totals.entries()]
    .sort((a, b) => a[1].sequence - b[1].sequence)
    .map(([value, total]) => ({ value, label: total.label, count: total.count }))
}
