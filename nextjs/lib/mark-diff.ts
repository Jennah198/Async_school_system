/**
 * Which mark rows actually moved.
 *
 * Every row posts the value it was rendered with alongside the current one, so
 * an untouched roster costs no writes and a single corrected score costs
 * exactly one. Kept out of the server action so it can be tested on its own —
 * a bug here silently drops a teacher's entry.
 */

export interface MarkValues {
  score?: number
  mark_status?: string
  note?: string
}

export interface MarkChange {
  markId: number
  values: MarkValues
}

function field(form: FormData, key: string): string {
  return String(form.get(key) ?? '')
}

export function changedRows(form: FormData, markIds: number[]): MarkChange[] {
  const changes: MarkChange[] = []

  for (const markId of markIds) {
    const values: MarkValues = {}
    const score = field(form, `score-${markId}`).trim()
    const status = field(form, `status-${markId}`).trim()
    const note = field(form, `note-${markId}`)

    // A blank score is "not entered yet", not "set this back to nothing":
    // school.mark has no way to un-record a score once one exists.
    if (score !== '' && score !== field(form, `was-score-${markId}`).trim()) {
      values.score = Number(score)
    }
    if (status !== '' && status !== field(form, `was-status-${markId}`)) {
      values.mark_status = status
    }
    if (note !== field(form, `was-note-${markId}`)) {
      values.note = note
    }

    if (Object.keys(values).length > 0) changes.push({ markId, values })
  }

  return changes
}
