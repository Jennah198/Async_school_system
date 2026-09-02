/**
 * Whether a set of grading bands covers 0 through 100 without a gap.
 *
 * Mirrors `school.grading.scheme.action_use_for_report_cards`, which refuses
 * to make a scheme the active one otherwise. Odoo still decides — this only
 * lets the page say so before the round trip, and explain which edge is wrong.
 *
 * The 0.011 tolerance is Odoo's: the seeded scale runs 0–49.99, 50–59.99 and
 * so on, so consecutive bands touch to within a hundredth rather than exactly.
 */
export interface Band {
  minimum_percentage: number
  maximum_percentage: number
}

const TOLERANCE = 0.011

export function coverageGap(bands: Band[]): string | null {
  if (bands.length === 0) return 'Add at least one band.'

  const sorted = [...bands].sort((a, b) => a.minimum_percentage - b.minimum_percentage)

  for (const band of sorted) {
    if (band.maximum_percentage < band.minimum_percentage) {
      return `A band runs from ${band.minimum_percentage} down to ${band.maximum_percentage}.`
    }
  }

  if (sorted[0].minimum_percentage !== 0) {
    return `The lowest band starts at ${sorted[0].minimum_percentage}, not 0.`
  }

  const highest = sorted[sorted.length - 1]
  if (highest.maximum_percentage !== 100) {
    return `The highest band ends at ${highest.maximum_percentage}, not 100.`
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]
    const current = sorted[i]
    if (Math.abs(current.minimum_percentage - previous.maximum_percentage) > TOLERANCE) {
      return `Nothing covers the range between ${previous.maximum_percentage} and ${current.minimum_percentage}.`
    }
  }

  return null
}

/** Odoo's `_check_overlap`: two bands may touch at a boundary but not straddle it. */
export function overlappingBands(bands: Band[]): string | null {
  const sorted = [...bands].sort((a, b) => a.minimum_percentage - b.minimum_percentage)
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]
    const current = sorted[i]
    if (current.minimum_percentage < previous.maximum_percentage) {
      return `Two bands both cover ${current.minimum_percentage}.`
    }
  }
  return null
}
