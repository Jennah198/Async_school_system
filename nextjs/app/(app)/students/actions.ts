'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/odoo/auth'
import { readOne } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import {
  createStudent,
  isUploadable,
  uploadStudentDocument,
  type ClassScope,
  type StudentIntake,
} from '@/lib/odoo/models/student'

export interface StudentFormState {
  error?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

const INTAKE_FIELDS = [
  'name',
  'date_of_birth',
  'gender',
  'guardian_name',
  'guardian_phone',
  'emergency_contact_name',
  'emergency_contact_phone',
  'fan_number',
  'class_id',
  'admission_type',
  'previous_school',
  'registration_date',
] as const

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}

function submitted(form: FormData): Record<string, string> {
  return Object.fromEntries(INTAKE_FIELDS.map((f) => [f, String(form.get(f) ?? '')]))
}

/**
 * Register a student in Draft.
 *
 * The scope fields Odoo's `_onchange_class_id` would derive — academic year,
 * section, education level, stream — are read back from the chosen class on
 * the server rather than trusted from the browser. `_check_registration_scope`
 * then verifies they agree, so a tampered payload is rejected by Odoo, not by
 * this function.
 */
export async function registerStudentAction(
  _previous: StudentFormState,
  form: FormData,
): Promise<StudentFormState> {
  await requireSession()

  const fieldErrors: Record<string, string> = {}
  const name = text(form, 'name')
  const dob = text(form, 'date_of_birth')
  const guardianName = text(form, 'guardian_name')
  const guardianPhone = text(form, 'guardian_phone')
  const emergencyName = text(form, 'emergency_contact_name')
  const emergencyPhone = text(form, 'emergency_contact_phone')
  const classId = Number(text(form, 'class_id'))

  if (!name) fieldErrors.name = 'Full name is required.'
  if (!dob) fieldErrors.date_of_birth = 'Date of birth is required.'
  if (!guardianName) fieldErrors.guardian_name = 'Parent or guardian name is required.'
  if (!guardianPhone) fieldErrors.guardian_phone = 'Guardian phone is required.'
  // Odoo marks both emergency-contact fields required=True on the model.
  if (!emergencyName) fieldErrors.emergency_contact_name = 'Emergency contact name is required.'
  if (!emergencyPhone) fieldErrors.emergency_contact_phone = 'Emergency contact phone is required.'
  if (!classId) fieldErrors.class_id = 'Choose a grade or class.'

  // Mirrors school.student._check_fan_format so the user hears sooner. Odoo
  // still validates, and owns the uniqueness constraint.
  const fan = text(form, 'fan_number')
  if (fan && !/^[0-9]{16}$/.test(fan)) {
    fieldErrors.fan_number = 'FAN must be exactly 16 digits.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: submitted(form) }
  }

  let scope: ClassScope | null
  try {
    scope = await readOne<ClassScope>('school.class', classId, [
      'name',
      'academic_year_id',
      'section_id',
      'stream_id',
      'education_level',
      'is_entry_level',
    ])
  } catch (cause) {
    return { error: toOdooError(cause).message, values: submitted(form) }
  }

  if (!scope?.academic_year_id) {
    return {
      error: 'That class has no academic year, so a student cannot be registered against it.',
      values: submitted(form),
    }
  }

  const intake: StudentIntake = {
    name,
    date_of_birth: dob,
    guardian_name: guardianName,
    guardian_phone: guardianPhone,
    emergency_contact_name: emergencyName,
    emergency_contact_phone: emergencyPhone,
    class_id: classId,
    academic_year_id: scope.academic_year_id[0],
    section_id: scope.section_id ? scope.section_id[0] : undefined,
    stream_id: scope.stream_id ? scope.stream_id[0] : undefined,
    education_level: scope.education_level || undefined,
    gender: text(form, 'gender') || undefined,
    admission_type: text(form, 'admission_type') || undefined,
    previous_school: text(form, 'previous_school') || undefined,
    registration_date: text(form, 'registration_date') || undefined,
    fan_number: fan || undefined,
  }

  let id: number
  try {
    id = await createStudent(intake)
  } catch (cause) {
    // Odoo's age-for-grade rule and scope checks produce messages written for
    // the registrar — surface them unchanged.
    return { error: toOdooError(cause).message, values: submitted(form) }
  }

  revalidatePath('/students')
  redirect(`/students/${id}`)
}

export interface UploadState {
  error?: string
  ok?: string
}

/** Files Odoo accepts on a student record, and nothing else. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

/**
 * Attach a document to a student.
 *
 * The bytes travel Browser → Next.js → Odoo and are never exposed through a
 * pre-signed URL: the binaries carry a registrar-only field group that only
 * Odoo can evaluate. Size and content type are checked here because Odoo only
 * validates the filename extension.
 */
export async function uploadStudentDocumentAction(
  _previous: UploadState,
  form: FormData,
): Promise<UploadState> {
  await requireSession()

  const studentId = Number(form.get('studentId'))
  const field = String(form.get('field') ?? '')
  const file = form.get('file')

  if (!Number.isFinite(studentId) || !isUploadable(field)) {
    return { error: 'That upload is not available.' }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file to upload.' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That file is larger than 8 MB.' }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only PDF, JPG and PNG files are accepted.' }
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  try {
    await uploadStudentDocument(studentId, field, file.name, base64)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: `${file.name} attached.` }
}
