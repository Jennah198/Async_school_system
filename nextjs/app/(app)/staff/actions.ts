'use server'
import { addResponsibility, endResponsibility, type ResponsibilityIntake } from '@/lib/odoo/models/staff'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { createStaff, updateStaff, type StaffIntake } from '@/lib/odoo/models/staff'

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

export interface ResponsibilityState {
  error?: string
  ok?: string
  fieldErrors?: Record<string, string>
}

export async function assignResponsibilityAction(
  _previous: ResponsibilityState,
  form: FormData,
): Promise<ResponsibilityState> {
  await requireSession()

  const staffId = Number(form.get('staffId'))
  if (!Number.isFinite(staffId) || staffId <= 0) {
    return { error: 'Missing staff record.' }
  }

  const responsibility = String(form.get('responsibility') ?? '').trim()
  const startDate = String(form.get('start_date') ?? '').trim()
  const department = String(form.get('department') ?? '').trim()
  const endDate = String(form.get('end_date') ?? '').trim()
  const isPrimary = form.get('is_primary') === 'on' || form.get('is_primary') === 'true'
  const campusId = Number(form.get('campus_id'))
  const managerId = Number(form.get('manager_id'))

  // Light client-side checks (Odoo is the real authority)
  const fieldErrors: Record<string, string> = {}
  if (!responsibility) fieldErrors.responsibility = 'Choose a responsibility.'
  if (!startDate) fieldErrors.start_date = 'Start date is required.'
  if (endDate && startDate && endDate < startDate) {
    fieldErrors.end_date = 'End date cannot be before start date.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  const values: ResponsibilityIntake = {
    responsibility,
    start_date: startDate,
    is_primary: isPrimary,
    department: department || undefined,
    end_date: endDate || undefined,
    campus_id: Number.isFinite(campusId) && campusId > 0 ? campusId : undefined,
    manager_id: Number.isFinite(managerId) && managerId > 0 ? managerId : undefined,
  }

  try {
    await addResponsibility(staffId, values)
  } catch (cause) {
    // Surface Odoo’s own messages (single primary, self-manager, etc.)
    return { error: toOdooError(cause).message }
  }

  revalidatePath(`/staff/${staffId}`)
  return { ok: 'Responsibility assigned.' }
}

export async function endResponsibilityAction(
  _previous: ResponsibilityState,
  form: FormData,
): Promise<ResponsibilityState> {
  await requireSession()

  const id = Number(form.get('id'))
  const staffId = Number(form.get('staffId'))
  const endDate = String(form.get('end_date') ?? '').trim() || new Date().toISOString().slice(0, 10)

  if (!Number.isFinite(id) || id <= 0) {
    return { error: 'Missing responsibility record.' }
  }

  try {
    await endResponsibility(id, endDate)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  if (Number.isFinite(staffId) && staffId > 0) {
    revalidatePath(`/staff/${staffId}`)
  }
  return { ok: 'Responsibility ended.' }
}