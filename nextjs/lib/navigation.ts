import type { SchoolRoles } from '@/lib/odoo/types'

/**
 * Role-aware navigation.
 *
 * Visibility is a UX decision, never a security one — Odoo re-checks every
 * call. What it encodes is the *measured* ACL coverage from staging, so nobody
 * is offered a door that opens onto a 403.
 *
 * Four record rules previously could not fire because the matching ACL row was
 * absent; those rows were added in security/ir.model.access.csv to match the
 * matrix in README.md, so Director and Front Office now read students, and
 * Director and Registrar read marks.
 *
 * Still absent from the CSV, and therefore still hidden here: Director has no
 * ACL row on school.teacher, school.class, school.subject, school.academic.year,
 * school.term or school.teacher.assignment, and Front Office has none on any
 * academic model. Widening those is an authorisation decision for the owner —
 * do not work around it in the frontend.
 */

interface NavRule {
  href: string
  label: string
  visible: (roles: SchoolRoles) => boolean
}

interface NavRuleSection {
  title: string
  items: NavRule[]
}

/** What crosses to the client. Predicates are evaluated on the server. */
export interface NavItem {
  href: string
  label: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const any = (...flags: boolean[]) => flags.some(Boolean)

const NAV_RULES: NavRuleSection[] = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', visible: () => true }],
  },
  {
    title: 'People',
    items: [
      {
        href: '/students',
        label: 'Students',
        visible: (r) =>
          any(r.isRegistrar, r.isTeacher, r.isAdmin, r.isExamOfficer, r.isDirector, r.isFrontOffice),
      },
      {
        href: '/enrollments',
        label: 'Enrolments',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isDirector, r.isTeacher),
      },
      {
        href: '/staff',
        label: 'Staff',
        visible: (r) =>
          any(r.isRegistrar, r.isAdmin, r.isDirector, r.isHr, r.isFrontOffice, r.isTeacher),
      },
      {
        // No director ACL row on school.teacher.
        href: '/teachers',
        label: 'Teachers',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isExamOfficer),
      },
    ],
  },
  {
    title: 'Academics',
    items: [
      {
        href: '/academic-years',
        label: 'Academic years',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isExamOfficer),
      },
      {
        href: '/classes',
        label: 'Classes',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isExamOfficer),
      },
      {
        href: '/subjects',
        label: 'Subjects',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isExamOfficer),
      },
      {
        href: '/configuration',
        label: 'Configuration',
        visible: (r) => any(r.isRegistrar, r.isAdmin),
      },
    ],
  },
  {
    title: 'Teaching',
    items: [
      {
        href: '/assignments',
        label: 'Teaching assignments',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher),
      },
      {
        // school.class.schedule carries ACL rows for admin and teacher only.
        href: '/schedule',
        label: 'Timetable',
        visible: (r) => any(r.isAdmin, r.isTeacher),
      },
      {
        // No director ACL row on school.attendance.
        href: '/attendance',
        label: 'Attendance',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher),
      },
    ],
  },
  {
    title: 'Assessment',
    items: [
      {
        href: '/assessments',
        label: 'Assessments',
        visible: (r) => any(r.isTeacher, r.isExamOfficer, r.isAdmin, r.isRegistrar, r.isDirector),
      },
      {
        href: '/marks',
        label: 'Marks',
        visible: (r) => any(r.isTeacher, r.isExamOfficer, r.isAdmin, r.isRegistrar, r.isDirector),
      },
      {
        href: '/report-cards',
        label: 'Report cards',
        visible: (r) => any(r.isExamOfficer, r.isAdmin, r.isDirector, r.isRegistrar),
      },
      {
        href: '/promotion',
        label: 'Promotion',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher),
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        // Director has no ACL row on school.announcement.
        href: '/announcements',
        label: 'Announcements',
        visible: (r) => any(r.isRegistrar, r.isFrontOffice, r.isAdmin, r.isTeacher),
      },
      {
        // No director ACL row on school.program.
        href: '/programs',
        label: 'Programs',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher),
      },
      {
        href: '/documents',
        label: 'Documents',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isHr),
      },
    ],
  },
]

export function visibleSections(roles: SchoolRoles): NavSection[] {
  return NAV_RULES.map((section) => ({
    title: section.title,
    // Drop the predicate: only href and label may cross to the client.
    items: section.items
      .filter((item) => item.visible(roles))
      .map(({ href, label }) => ({ href, label })),
  })).filter((section) => section.items.length > 0)
}

/** Human label for the signed-in user's strongest role. */
export function primaryRoleLabel(roles: SchoolRoles): string {
  if (roles.isAdmin) return 'Administrator'
  if (roles.isDirector) return 'Director'
  if (roles.isRegistrar) return 'Registrar'
  if (roles.isExamOfficer) return 'Exam Officer'
  if (roles.isHr) return 'HR Officer'
  if (roles.isFrontOffice) return 'Front Office'
  if (roles.isTeacher) return 'Teacher'
  return 'Staff'
}
