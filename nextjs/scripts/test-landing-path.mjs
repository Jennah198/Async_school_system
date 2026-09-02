/** Run: node scripts/test-landing-path.mjs */
import assert from 'node:assert/strict'
import { landingPath, primaryRoleLabel } from '../lib/navigation.ts'

const NONE = {
  isAdmin: false, isDirector: false, isRegistrar: false, isTeacher: false,
  isFrontOffice: false, isExamOfficer: false, isHr: false,
}
const only = (role) => ({ ...NONE, [role]: true })

assert.equal(landingPath(only('isAdmin')), '/dashboard')
assert.equal(landingPath(only('isDirector')), '/dashboard')
assert.equal(landingPath(only('isRegistrar')), '/students?status=submitted')
assert.equal(landingPath(only('isExamOfficer')), '/assessments?status=submitted')
assert.equal(landingPath(only('isHr')), '/staff')
assert.equal(landingPath(only('isFrontOffice')), '/students')
assert.equal(landingPath(only('isTeacher')), '/assessments?status=open')

// Somebody with no school group still gets a page, not a dead end.
assert.equal(landingPath(NONE), '/dashboard')

// The landing must never contradict the role the shell displays: both walk the
// same precedence, so for any combination the landing equals the landing of
// the single role primaryRoleLabel picked out.
const BY_LABEL = {
  Administrator: 'isAdmin', Director: 'isDirector', Registrar: 'isRegistrar',
  'Exam Officer': 'isExamOfficer', 'HR Officer': 'isHr',
  'Front Office': 'isFrontOffice', Teacher: 'isTeacher',
}
const ROLES = Object.keys(NONE)
for (const high of ROLES) {
  for (const low of ROLES) {
    const both = { ...NONE, [high]: true, [low]: true }
    const shown = BY_LABEL[primaryRoleLabel(both)]
    assert.equal(
      landingPath(both),
      landingPath(only(shown)),
      `${high}+${low} lands away from its displayed role (${primaryRoleLabel(both)})`,
    )
  }
}

// The concrete case that matters: a teacher who is also an exam officer.
const both = { ...NONE, isTeacher: true, isExamOfficer: true }
assert.equal(primaryRoleLabel(both), 'Exam Officer')
assert.equal(landingPath(both), '/assessments?status=submitted',
  'the landing follows the role the shell shows')

// And an administrator who also teaches keeps the overview.
const adminTeacher = { ...NONE, isAdmin: true, isTeacher: true }
assert.equal(primaryRoleLabel(adminTeacher), 'Administrator')
assert.equal(landingPath(adminTeacher), '/dashboard')

console.log('landing-path: ok')
