import 'server-only'
import { readGroup } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import type { Domain, Many2one } from '@/lib/odoo/types'

/**
 * The aggregations behind the graph and pivot views.
 *
 * These read through `read_group`, which applies the same record rules as any
 * other read -- a teacher's numbers cover their own classes and a director's
 * cover the school, without either query saying so.
 *
 * Every result carries `__count` alongside the measure, because a sum and an
 * average are not interchangeable: total teaching periods is a sum, an average
 * mark is not. Carrying the count lets the caller choose per measure rather
 * than baking one in.
 */

export interface GroupResult {
  __count: number
  [field: string]: unknown
}

/** A groupby value arrives as a Many2one pair, a selection code, or false. */
export function groupLabel(value: unknown, fallback = 'None'): string {
  if (Array.isArray(value)) return String(value[1] ?? fallback)
  if (value === false || value === null || value === undefined || value === '') return fallback
  return String(value)
}

export function aggregate(
  model: string,
  options: { domain?: Domain; measures?: readonly string[]; groupby: readonly string[] },
): Promise<GroupResult[] | null> {
  return orNullOnRefusal(
    readGroup<GroupResult>(
      model,
      options.domain ?? [],
      options.measures ?? [],
      options.groupby,
    ),
  )
}

/* ------------------------------------------------------------- measures --- */

/**
 * Odoo's own graph view sums `school.mark.percentage`, because the field
 * declares no aggregator and sum is the default. A summed percentage is not a
 * quantity anyone can act on, so these views average it and say so on screen.
 * The sum is still available in the raw total if it is ever wanted.
 */
export const MARK_MEASURE = 'percentage'

/** Periods per week is a genuine total -- a teacher's load is the sum. */
export const ASSIGNMENT_MEASURE = 'weekly_periods'

export type Many2oneValue = Many2one
