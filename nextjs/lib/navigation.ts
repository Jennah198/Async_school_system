import type { SchoolRoles } from '@/lib/odoo/types'

/**
 * Role-aware navigation.
 *
 * Visibility here is a UX decision, never a security one — Odoo re-checks
 * every call. What it encodes is the *measured* permission matrix, so people
 * are not shown doors that open onto a 403.
 *
 * Four record rules previously could not fire because the matching ACL row was
 * absent (rule_student_all_director, rule_student_contact_frontoffice,
 * rule_mark_all_registrar, rule_mark_all_director). The missing rows have been
 * added in security/ir.model.access.csv to match the access matrix documented
 * in README.md, so Director and Front Office can now read students, and
 * Director and Registrar can read marks. The predicates below reflect that.
 */

interface NavRule {
  href: string
  label: string
  /** Returns true when this role combination can actually use the screen. */
  visible: (roles: SchoolRoles) => boolean
}

interface NavRuleSection {
  title: string
  items: NavRule[]
}

/**
 * What crosses into the client component. The predicates above are evaluated
 * on the server and never serialised — a function cannot cross the boundary,
 * and the decision is not the browser's to make in any case.
 */
export interface NavItem {
  href: string
  label: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const any = (...flags: Array<boolean>) => flags.some(Boolean)

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
        // Registrar RWC; Teacher R scoped to own classes; Exam Officer,
        // Director and Front Office read-only and unscoped.
        visible: (r) =>
          any(r.isRegistrar, r.isTeacher, r.isAdmin, r.isExamOfficer, r.isDirector, r.isFrontOffice),
        // All six hold an ACL row on school.student.
      },
      {
        href: '/staff',
        label: 'Staff',
        visible: (r) =>
          any(r.isRegistrar, r.isAdmin, r.isDirector, r.isHr, r.isFrontOffice, r.isTeacher),
      },
      {
        href: '/teachers',
        label: 'Teachers',
        // Director is excluded: there is no ACL row for group_school_director
        // on school.teacher, so the page would answer 403.
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
        // No director ACL row on school.class — see /teachers above.
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isExamOfficer),
      },
      {
        href: '/subjects',
        label: 'Subjects',
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isExamOfficer),
      },
    ],
  },
  {
    title: 'Teaching',
    items: [
      {
        href: '/assignments',
        label: 'Teaching assignments',
        // No director ACL row on school.teacher.assignment.
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher),
      },
      {
        href: '/marks',
        label: 'Marks',
        // Teacher RW scoped to their own assignment; Exam Officer and
        // Registrar full; Director read-only.
        visible: (r) =>
          any(r.isTeacher, r.isExamOfficer, r.isAdmin, r.isRegistrar, r.isDirector),
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
