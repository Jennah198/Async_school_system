import 'server-only'
import { callAction, callKw, create, readOne, searchRead, write } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import type { Page } from '@/lib/odoo/types'

/**
 * Grading schemes and their bands.
 *
 * Two files in the addon declare a `school.grading.band`; only the one in
 * `school_results.py` is imported by `models/__init__.py`, so the live model
 * is the scheme-backed one — `scheme_id`, `name`, `minimum_percentage`,
 * `maximum_percentage`, `remark`. The `school.grading.policy` variant is never
 * registered, and nothing here should reach for it.
 *
 * Making a scheme the active one goes through `action_use_for_report_cards`,
 * never through a write: that method checks the bands cover 0–100 and sets
 * both `school_grading_scheme_id` and `school_grading_configured` on the
 * company. Assessment publishing reads the second of those, so writing one
 * without the other leaves publishing blocked for a reason nobody can see.
 */

/* ---------------------------------------------------------------- read --- */

export interface SchemeRow {
  id: number
  name: string
  pass_percentage: number
  active: boolean
  is_company_scheme: boolean
  band_ids: number[]
}

const SCHEME_FIELDS = [
  'name',
  'pass_percentage',
  'active',
  'is_company_scheme',
  'band_ids',
] as const

export function listGradingSchemes(): Promise<Page<SchemeRow> | null> {
  return orNullOnRefusal(
    searchRead<SchemeRow>('school.grading.scheme', SCHEME_FIELDS, {
      // Inactive schemes are the ones a school has retired; they still need to
      // be visible to be reactivated, so the archived filter is lifted.
      context: { active_test: false },
      order: 'name',
      limit: 100,
    }),
  )
}

export function getGradingScheme(id: number): Promise<SchemeRow | null> {
  return orNullOnRefusal(readOne<SchemeRow>('school.grading.scheme', id, SCHEME_FIELDS))
}

export interface BandRow {
  id: number
  name: string
  minimum_percentage: number
  maximum_percentage: number
  remark: string | false
}

export function listBands(schemeId: number): Promise<Page<BandRow> | null> {
  return orNullOnRefusal(
    searchRead<BandRow>(
      'school.grading.band',
      ['name', 'minimum_percentage', 'maximum_percentage', 'remark'],
      { domain: [['scheme_id', '=', schemeId]], order: 'minimum_percentage desc', limit: 100 },
    ),
  )
}

/* --------------------------------------------------------------- write --- */

export interface BandIntake {
  name: string
  minimum_percentage: number
  maximum_percentage: number
  remark?: string
}

export interface SchemeIntake {
  name: string
  pass_percentage: number
  bands: BandIntake[]
}

/**
 * Create a scheme and its bands in one call.
 *
 * The bands go in as `(0, 0, values)` commands rather than a second round of
 * creates, so `_check_overlap` sees the whole set at once and a scheme is
 * never left half-built by a mid-way refusal.
 */
export function createGradingScheme(intake: SchemeIntake): Promise<number> {
  return create('school.grading.scheme', {
    name: intake.name,
    pass_percentage: intake.pass_percentage,
    band_ids: intake.bands.map((band) => [0, 0, { ...band }]),
  })
}

export function updateGradingScheme(
  id: number,
  values: Record<string, unknown>,
): Promise<boolean> {
  return write('school.grading.scheme', [id], values)
}

export function addBand(schemeId: number, band: BandIntake): Promise<number> {
  return create('school.grading.band', { scheme_id: schemeId, ...band })
}

export function removeBand(id: number): Promise<boolean> {
  return callKw<boolean>('school.grading.band', 'unlink', [[id]])
}

/**
 * Make this the scheme report cards and published assessments are graded by.
 *
 * Odoo refuses unless the bands cover 0–100 with no gap, and the refusal is
 * the same message the user would get in the backend.
 */
export function activateForReportCards(id: number): Promise<boolean> {
  return callAction<boolean>('school.grading.scheme', 'action_use_for_report_cards', [id])
}
