import 'server-only'

/**
 * Types at the Odoo boundary.
 *
 * Deliberately not a generated type per model: 59 school.* models exist, and
 * most screens read a handful of fields from a few of them. Types live where
 * data crosses into the application, and grow as screens are built.
 */

/** Odoo returns a Many2one as [id, display_name], or false when unset. */
export type Many2one = [number, string] | false

/** Odoo returns a Selection as its raw code, or false when unset. */
export type Selection<T extends string = string> = T | false

/** One2many / Many2many read back as an array of ids. */
export type Ids = number[]

export interface OdooRecord {
  id: number
}

export function m2oId(value: Many2one): number | null {
  return value ? value[0] : null
}

export function m2oLabel(value: Many2one, fallback = '—'): string {
  return value ? value[1] : fallback
}

/**
 * The school scope Odoo already flattens onto res.users
 * (addons/school_management/models/res_users.py). This is the payload the
 * frontend needs to render role-aware navigation, and it exists server-side
 * already — it is not something the browser may assert.
 */
export interface SchoolScope {
  id: number
  name: string
  login: string
  school_department: string
  school_teacher_id: Many2one
  school_taught_class_ids: Ids
  school_taught_subject_ids: Ids
  school_campus_ids: Ids
  school_responsibility_list: string[]
}

/**
 * Group membership, resolved server-side. Used only to decide what to render;
 * Odoo's ACLs and record rules remain the authorisation boundary.
 */
export interface SchoolRoles {
  isAdmin: boolean
  isDirector: boolean
  isRegistrar: boolean
  isTeacher: boolean
  isFrontOffice: boolean
  isExamOfficer: boolean
  isHr: boolean
}

export interface CurrentUser extends SchoolScope {
  roles: SchoolRoles
}

/** Paged list result for every list screen. */
export interface Page<T> {
  rows: T[]
  total: number
  offset: number
  limit: number
}

/** An Odoo search domain. Left loose on purpose — Odoo validates it. */
export type Domain = unknown[]
