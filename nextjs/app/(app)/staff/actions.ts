'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import {
  createStaff,
  runStaffTransition,
  updateStaff,
  type StaffIntake,
  type StaffTransition,
} from '@/lib/odoo/models/staff'

/**
 * Every mutation here runs as the signed-in user's Odoo session. Nothing from
 * the browser is trusted for authorisation — no user id, no role, no staff id.
 * Odoo re-checks the ACL, the record rule and every constraint, and a refusal
 * comes back as a safe message.
 */

export interface FormState {
  error?: string
  fieldErrors?: Record<string, string>
  ok?: boolean
  /**
   * What the user typed, echoed back so a rejected submit does not empty the
   * form. A server-action form re-renders from scratch, so uncontrolled inputs
   * lose their values unless they are given back explicitly.
   */
  values?: Record<string, string>
}

/** Every field the registration form posts, for round-tripping on error. */
const INTAKE_FIELDS = [
  'first_name', 'last_name', 'gender', 'date_of_birth', 'fayda_id',
  'phone', 'mobile', 'email', 'department', 'job_title_id',
  'employment_type', 'employment_status', 'hire_date', 'responsibility',
] as const

function submittedValues(form: FormData): Record<string, string> {
  return Object.fromEntries(INTAKE_FIELDS.map((f) => [f, String(form.get(f) ?? '')]))
}

const TRANSITIONS: Record<string, StaffTransition> = {
  activate: 'action_activate',
  suspend: 'action_suspend',
  deactivate: 'action_deactivate',
  reset: 'action_reset_draft',
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}

/** Client-side checks are for speed of feedback only; Odoo decides. */
function validateIntake(form: FormData): { values?: StaffIntake; fieldErrors?: Record<string, string> } {
  const fieldErrors: Record<string, string> = {}
  const first_name = text(form, 'first_name')
  const last_name = text(form, 'last_name')
  const department = text(form, 'department')
  const jobTitle = text(form, 'job_title_id')
  const responsibility = text(form, 'responsibility')
  const employment_status = text(form, 'employment_status')

  if (!first_name) fieldErrors.first_name = 'First name is required.'
  if (!last_name) fieldErrors.last_name = 'Last name is required.'
  if (!department) fieldErrors.department = 'Choose a department.'
  if (!jobTitle) fieldErrors.job_title_id = 'Choose a job title.'
  if (!responsibility) fieldErrors.responsibility = 'Choose a responsibility.'
  if (!employment_status) fieldErrors.employment_status = 'Choose an employment status.'

  const fayda = text(form, 'fayda_id')
  // Mirrors school.staff._check_fayda_id purely so the user hears sooner.
  if (fayda && !/^[0-9]{16}$/.test(fayda)) {
    fieldErrors.fayda_id = 'Fayda ID must be exactly 16 digits.'
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  return {
    values: {
      first_name,
      last_name,
      department,
      job_title_id: Number(jobTitle),
      employment_status,
      responsibility,
      employment_type: text(form, 'employment_type') || undefined,
      gender: text(form, 'gender') || undefined,
      phone: text(form, 'phone') || undefined,
      mobile: text(form, 'mobile') || undefined,
      email: text(form, 'email') || undefined,
      hire_date: text(form, 'hire_date') || undefined,
      date_of_birth: text(form, 'date_of_birth') || undefined,
      fayda_id: fayda || undefined,
    },
  }
}

export async function registerStaffAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  await requireSession()
  const { values, fieldErrors } = validateIntake(form)
  if (fieldErrors) return { fieldErrors, values: submittedValues(form) }

  let id: number
  try {
    id = await createStaff(values!)
  } catch (cause) {
    // Odoo's ValidationError messages are written for end users — the Fayda
    // duplicate, the minimum-age rule, the phone clash. Surface them as-is.
    return { error: toOdooError(cause).message, values: submittedValues(form) }
  }

  revalidatePath('/staff')
  redirect(`/staff/${id}`)
}

export async function staffTransitionAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  await requireSession()
  const id = Number(text(form, 'id'))
  const transition = TRANSITIONS[text(form, 'transition')]

  if (!id || !transition) return { error: 'That action is not available.' }

  try {
    await runStaffTransition(id, transition)
  } catch (cause) {
    // Activation fails loudly when Odoo's completeness rule is unmet; the
    // message names exactly which fields are missing.
    return { error: toOdooError(cause).message }
  }

  revalidatePath(`/staff/${id}`)
  revalidatePath('/staff')
  return { ok: true }
}

export async function updateStaffAction(_previous: FormState, form: FormData): Promise<FormState> {
  await requireSession()
  const id = Number(text(form, 'id'))
  if (!id) return { error: 'Missing record.' }

  const editable = ['phone', 'mobile', 'email', 'hire_date', 'end_date', 'employment_status', 'employment_type']
  const values: Record<string, unknown> = {}
  for (const field of editable) {
    if (form.has(field)) values[field] = text(form, field) || false
  }

  try {
    await updateStaff(id, values)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath(`/staff/${id}`)
  return { ok: true }
}
