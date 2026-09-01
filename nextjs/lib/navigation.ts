import type { SchoolRoles } from '@/lib/odoo/types'

/**
 * Role-aware navigation.
 *
 * Visibility here is a UX decision, never a security one — Odoo re-checks
 * every call. What it encodes is the *measured* permission matrix from the
 * Phase E staging tests, so people are not shown doors that open onto a 403.
 *
 * Four record rules are known to be ineffective because the matching ACL row
 * is missing (rule_student_all_director, rule_student_contact_frontoffice,
 * rule_mark_all_registrar, rule_mark_all_director). Verified on staging:
 * Director and Front Office get AccessError on school.student, and Registrar
 * and Director get AccessError on school.mark. Those entries are therefore
 * NOT shown to those roles. When the ACLs are fixed, widen the predicates
 * below — do not work around them in the frontend.
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
        // Registrar RWC, Teacher R (own classes), Exam Officer R.
        // Director and Front Office are excluded: no ACL row exists.
        visible: (r) => any(r.isRegistrar, r.isTeacher, r.isAdmin, r.isExamOfficer),
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
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isDirector, r.isExamOfficer),
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
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isDirector, r.isExamOfficer),
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
        visible: (r) => any(r.isRegistrar, r.isAdmin, r.isTeacher, r.isDirector),
      },
      {
        href: '/marks',
        label: 'Marks',
        // Teacher RW (own assignment), Exam Officer full.
        // Registrar and Director are excluded: no ACL row exists.
        visible: (r) => any(r.isTeacher, r.isExamOfficer, r.isAdmin),
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
