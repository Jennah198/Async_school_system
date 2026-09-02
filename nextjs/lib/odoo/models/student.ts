import 'server-only'
import { create, readOne, searchRead, write } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import { listDomain, type ListOptions } from '@/lib/odoo/list'
import type { Many2one, Page, Selection } from '@/lib/odoo/types'

/**
 * Student registration, guardians and enrolment.
 *
 * The registration lifecycle is Odoo's, not this layer's:
 * draft → pending_verification → submitted → approved, driven by
 * `action_mark_submitted` / `action_mark_approved`. Approval is what mints the
 * student and admission numbers and creates both the enrolment and the
 * guardian link, so it is never simulated by writing fields.
 */


/* ---------------------------------------------------------------- read --- */

export interface StudentDetail {
  id: number
  name: string
  regno: string | false
  admission_number: string | false
  first_name: string | false
  middle_name: string | false
  last_name: string | false
  gender: Selection
  class_id: Many2one
  academic_year_id: Many2one
  section_id: Many2one
  stream_id: Many2one
  education_level: Selection
  admission_type: Selection
  registration_status: Selection
  lifecycle_status: Selection
  registration_date: string | false
  guardian_name: string | false
  guardian_phone: string | false
  previous_school: string | false
  enrollment_count: number
  active: boolean
}

const STUDENT_DETAIL_FIELDS = [
  'name',
  'regno',
  'admission_number',
  'first_name',
  'middle_name',
  'last_name',
  'gender',
  'class_id',
  'academic_year_id',
  'section_id',
  'stream_id',
  'education_level',
  'admission_type',
  'registration_status',
  'lifecycle_status',
  'registration_date',
  'guardian_name',
  'guardian_phone',
  'previous_school',
  'enrollment_count',
  'active',
] as const

export function getStudent(id: number): Promise<StudentDetail | null> {
  return readOne<StudentDetail>('school.student', id, STUDENT_DETAIL_FIELDS)
}

/**
 * Date of birth and the national/regional identifiers carry field-level
 * groups (registrar only). A role without them gets AccessError, so this
 * resolves to null and the page renders "restricted" — the value is never
 * obtained by another route.
 */
export function getStudentPersonalData(
  id: number,
): Promise<{
  date_of_birth: string | false
  age: number
  fan_number: string | false
} | null> {
  return orNullOnRefusal(
    readOne<{ date_of_birth: string | false; age: number; fan_number: string | false }>(
      'school.student',
      id,
      ['date_of_birth', 'age', 'fan_number'],
    ),
  )
}

export interface GuardianRow {
  id: number
  partner_id: Many2one
  name: string | false
  relationship: Selection
  is_primary: boolean
  phone: string | false
  occupation: string | false
}

export function listGuardians(studentId: number): Promise<Page<GuardianRow> | null> {
  return orNullOnRefusal(
    searchRead<GuardianRow>(
      'school.student.guardian',
      ['partner_id', 'name', 'relationship', 'is_primary', 'phone', 'occupation'],
      { domain: [['student_id', '=', studentId]], limit: 25 },
    ),
  )
}

export interface EnrollmentRow {
  id: number
  name: string
  student_id: Many2one
  class_id: Many2one
  academic_year_id: Many2one
  roll_number: number
  admission_type: Selection
  enrollment_date: string
  end_date: string | false
  state: Selection
}

const ENROLLMENT_FIELDS = [
  'name',
  'student_id',
  'class_id',
  'academic_year_id',
  'roll_number',
  'admission_type',
  'enrollment_date',
  'end_date',
  'state',
] as const

export const ENROLLMENT_FILTERS = {
  status: { field: 'state' },
  admission: { field: 'admission_type' },
  class: { field: 'class_id', kind: 'many2one' },
  year: { field: 'academic_year_id', kind: 'many2one' },
} as const

export function listEnrollments(
  options: ListOptions & { studentId?: number } = {},
): Promise<Page<EnrollmentRow>> {
  return searchRead<EnrollmentRow>('school.enrollment', ENROLLMENT_FIELDS, {
    domain: listDomain(options, {
      base: options.studentId ? [['student_id', '=', options.studentId]] : [],
      searchFields: ['name', 'student_id.name'],
      filters: ENROLLMENT_FILTERS,
    }),
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
    order: options.order ?? 'enrollment_date desc',
  })
}

export function getEnrollment(id: number): Promise<EnrollmentRow | null> {
  return readOne<EnrollmentRow>('school.enrollment', id, ENROLLMENT_FIELDS)
}

export interface StudentSubjectRow {
  id: number
  subject_id: Many2one
  class_id: Many2one
  subject_type: Selection
  state: Selection
  date_start: string
  date_end: string | false
}

export function listStudentSubjects(enrollmentId: number): Promise<Page<StudentSubjectRow> | null> {
  return orNullOnRefusal(
    searchRead<StudentSubjectRow>(
      'school.student.subject',
      ['subject_id', 'class_id', 'subject_type', 'state', 'date_start', 'date_end'],
      { domain: [['enrollment_id', '=', enrollmentId]], limit: 50 },
    ),
  )
}

export interface PlacementRow {
  id: number
  class_id: Many2one
  shift_id: Many2one
  stream_id: Many2one
  roll_number: number
  date_start: string
  date_end: string | false
}

export function listPlacements(enrollmentId: number): Promise<Page<PlacementRow> | null> {
  return orNullOnRefusal(
    searchRead<PlacementRow>(
      'school.enrollment.placement',
      ['class_id', 'shift_id', 'stream_id', 'roll_number', 'date_start', 'date_end'],
      { domain: [['enrollment_id', '=', enrollmentId]], limit: 25, order: 'date_start desc' },
    ),
  )
}

/**
 * What Odoo says still blocks submission.
 *
 * `_validate_submission_requirements` is private, so the equivalent public
 * signal is attempting the transition. Rather than guess, the UI reads the
 * fields the rule names and lets Odoo produce the authoritative list when the
 * user submits — the error message enumerates exactly what is missing.
 */

/* --------------------------------------------------------------- write --- */

export interface StudentIntake {
  name: string
  date_of_birth: string
  guardian_name: string
  guardian_phone: string
  /** Required on the model itself, not just at submission. */
  emergency_contact_name: string
  emergency_contact_phone: string
  class_id: number
  academic_year_id: number
  /** Derived from the class, mirroring Odoo's _onchange_class_id. */
  section_id?: number
  education_level?: string
  stream_id?: number
  gender?: string
  admission_type?: string
  previous_school?: string
  registration_date?: string
  /**
   * FAN (National ID) — exactly 16 digits, unique across students, and
   * required before a registration can be submitted. Field-restricted to the
   * registrar and administrator groups.
   */
  fan_number?: string
}

/**
 * Create a student in Draft.
 *
 * `_onchange_class_id` fills academic_year_id, section_id, education_level and
 * stream_id from the chosen class, and `_check_registration_scope` then
 * enforces that they agree. Onchange never fires over RPC, so the caller
 * resolves those from the class record and submits them explicitly — the rule
 * still lives in Odoo's data.
 */
export function createStudent(intake: StudentIntake): Promise<number> {
  const values = Object.fromEntries(
    Object.entries(intake).filter(([, value]) => value !== undefined && value !== ''),
  )
  return create('school.student', values)
}

/**
 * Attach a document to a student.
 *
 * `birth_certificate` and `previous_grade_document` are Binary fields with
 * `attachment=True`, so Odoo stores the payload in ir.attachment and keeps
 * only the pointer on the record. Both carry a registrar-only field group —
 * a role without it gets AccessError, which is the intended behaviour.
 *
 * Only these two fields are writable through here; the caller cannot name an
 * arbitrary binary column.
 */
const UPLOADABLE = {
  birth_certificate: 'birth_certificate_filename',
  previous_grade_document: 'previous_grade_document_filename',
} as const

export type UploadableField = keyof typeof UPLOADABLE

export function isUploadable(field: string): field is UploadableField {
  return Object.prototype.hasOwnProperty.call(UPLOADABLE, field)
}

export async function uploadStudentDocument(
  studentId: number,
  field: UploadableField,
  filename: string,
  base64: string,
): Promise<boolean> {
  return write('school.student', [studentId], {
    [field]: base64,
    [UPLOADABLE[field]]: filename,
  })
}

/** Which documents are already attached, without transferring the bytes. */
export function getStudentDocuments(
  id: number,
): Promise<{ birth_certificate_filename: string | false; previous_grade_document_filename: string | false } | null> {
  return orNullOnRefusal(
    readOne('school.student', id, [
      'birth_certificate_filename',
      'previous_grade_document_filename',
    ]),
  )
}

/** The class fields the registration form must echo back. See createStudent. */
export interface ClassScope {
  id: number
  name: string
  academic_year_id: Many2one
  section_id: Many2one
  stream_id: Many2one
  education_level: Selection
  is_entry_level: boolean
}

export async function listClassScopes(): Promise<ClassScope[]> {
  const page = await searchRead<ClassScope>(
    'school.class',
    ['name', 'academic_year_id', 'section_id', 'stream_id', 'education_level', 'is_entry_level'],
    { domain: [['active', '=', true]], limit: 200, order: 'name' },
  )
  return page.rows
}

/* ------------------------------------------------------------ guardian --- */

export interface GuardianIntake {
  name: string
  phone?: string
  relationship: string
  occupation?: string
  is_primary?: boolean
}

/**
 * Add a guardian to a student.
 *
 * Mirrors `school.student._ensure_guardian`: reuse an existing res.partner
 * with the same name and phone rather than creating a duplicate contact, so
 * one parent can serve several students as a single record. Odoo still owns
 * `_check_single_primary` — a second `is_primary=True` here is rejected by
 * the model, not pre-checked in this layer.
 */
export async function createGuardian(studentId: number, intake: GuardianIntake): Promise<number> {
  const phone = intake.phone || false

  const existing = await searchRead<{ id: number }>('res.partner', ['id'], {
    domain: [
      ['name', '=', intake.name],
      ['phone', '=', phone],
    ],
    limit: 1,
  })

  const partnerId =
    existing.rows[0]?.id ?? (await create('res.partner', { name: intake.name, phone, type: 'contact' }))

  if (existing.rows[0] && phone) {
    // An existing contact keeps whatever phone it already has unless this
    // guardian link is the one supplying it.
    await write('res.partner', [partnerId], { phone })
  }

  return create('school.student.guardian', {
    student_id: studentId,
    partner_id: partnerId,
    relationship: intake.relationship,
    occupation: intake.occupation || false,
    is_primary: intake.is_primary ?? false,
  })
}

export interface GuardianUpdate {
  relationship?: string
  phone?: string
  occupation?: string
  is_primary?: boolean
}

/** Edit an existing guardian link. `phone` is a related field onto the partner. */
export function updateGuardian(guardianId: number, values: GuardianUpdate): Promise<boolean> {
  const payload = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  )
  return write('school.student.guardian', [guardianId], payload)
}
export interface GlobalGuardianRow {
  id: number
  student_id: Many2one
  partner_id: Many2one
  name: string | false
  relationship: Selection
  phone: string | false
  occupation: string | false
  is_primary: boolean
}

export const GUARDIAN_FILTERS = {
  relationship: { field: 'relationship' },
} as const

export function listAllGuardians(
  options: ListOptions = {},
): Promise<Page<GlobalGuardianRow>> {
  return searchRead<GlobalGuardianRow>(
    'school.student.guardian',
    [
      'student_id',
      'partner_id',
      'name',
      'relationship',
      'phone',
      'occupation',
      'is_primary',
    ],
    {
      domain: listDomain(options, {
        searchFields: [
          'student_id.name',
          'partner_id.name',
          'name',
          'phone',
          'occupation',
        ],
        filters: GUARDIAN_FILTERS,
      }),
      limit: options.limit ?? 25,
      offset: options.offset ?? 0,
      order: options.order ?? 'student_id',
    },
  )
}