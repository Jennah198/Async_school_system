/**
 * Split a stored full name back into the parts Odoo computes it from.
 *
 * `school.student.name` is `compute='_compute_name'` over first/middle/last
 * with a no-op inverse, so a record whose parts are empty keeps whatever name
 * was written until the next time a part changes — at which point the compute
 * fires and the name is rebuilt from the (empty) parts. Registration writes
 * `name` directly, so every student created through this app is in exactly
 * that state, and an edit form that offered the parts blank would erase the
 * name on the first save.
 *
 * Seeding the parts from the stored name makes the edit round-trip lossless:
 * ' '.join of the parts returned here is always the original name.
 */
export interface NameParts {
  first: string
  middle: string
  last: string
}

export function splitFullName(name: string): NameParts {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { first: '', middle: '', last: '' }
  if (words.length === 1) return { first: words[0], middle: '', last: '' }
  return {
    first: words[0],
    // ponytail: everything between the first and last word is one middle name.
    // Ethiopian names are given + father + grandfather, so three words is the
    // common case and the extra words only ever appear together.
    middle: words.slice(1, -1).join(' '),
    last: words[words.length - 1],
  }
}

export function joinFullName({ first, middle, last }: NameParts): string {
  return [first, middle, last].map((part) => part.trim()).filter(Boolean).join(' ')
}

/**
 * The parts an edit form should start from.
 *
 * Stored parts are only trustworthy when they still rebuild the stored name.
 * They often do not: the demo seed writes `name` in full alongside a partial
 * first/last, so student 'SRS Demo Abel Kebede' carries first 'SRS' and last
 * 'Kebede' and nothing else. Editing from those parts and saving would run
 * `_compute_name` and quietly shorten the student's name to 'SRS Kebede'.
 *
 * Falling back to a split of the stored name keeps the first save lossless
 * whatever state the record is in.
 */
export function editableNameParts(name: string, stored: NameParts): NameParts {
  return joinFullName(stored) === name.trim() ? stored : splitFullName(name)
}
