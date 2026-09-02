/**
 * Which attendance rows actually changed.
 *
 * Every row posts the status it was rendered with alongside the current one,
 * so an untouched register costs no writes and one correction costs one.
 * Kept out of the server action so it can be tested on its own — a bug here
 * silently drops a teacher's register.
 */

export interface StatusChange {
  id: number
  status: string
}

export function changedStatuses(form: FormData, ids: number[]): StatusChange[] {
  const changes: StatusChange[] = []

  for (const id of ids) {
    const status = String(form.get(`status-${id}`) ?? '').trim()
    const was = String(form.get(`was-status-${id}`) ?? '').trim()
    if (status && status !== was) changes.push({ id, status })
  }

  return changes
}
