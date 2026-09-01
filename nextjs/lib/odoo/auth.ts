import 'server-only'
import { redirect } from 'next/navigation'
import { odooConfig } from './config'
import { OdooError } from './errors'
import { jsonRpc, rawCallKw } from './rpc'
import { clearSession, readSession, writeSession, type AppSession } from './session'
import type { CurrentUser, SchoolRoles, SchoolScope } from './types'

/**
 * Authentication against Odoo.
 *
 *   Browser → Next.js Route Handler → /web/session/authenticate → Odoo
 *
 * The password is forwarded once and never stored. What comes back is an Odoo
 * session id, which is sealed into this app's own cookie.
 */

/** Fields Odoo already computes for us — see models/res_users.py. */
const SCOPE_FIELDS = [
  'name',
  'login',
  'school_department',
  'school_teacher_id',
  'school_taught_class_ids',
  'school_taught_subject_ids',
  'school_campus_ids',
  'school_responsibility_list',
] as const

/**
 * Group membership is resolved server-side with Odoo's own `has_group`. It
 * decides what to render — never whether an operation is allowed. Odoo's ACLs
 * and record rules remain the only authorisation boundary.
 */
const ROLE_GROUPS: Record<keyof SchoolRoles, string> = {
  isAdmin: 'school_management.group_school_admin',
  isDirector: 'school_management.group_school_director',
  isRegistrar: 'school_management.group_school_registrar',
  isTeacher: 'school_management.group_school_teacher',
  isFrontOffice: 'school_management.group_school_frontoffice',
  isExamOfficer: 'school_management.group_school_exam_officer',
  isHr: 'school_management.group_school_hr',
}

async function loadCurrentUser(odooSessionId: string, uid: number): Promise<CurrentUser> {
  const [record] = await rawCallKw<Array<Record<string, unknown>>>(
    odooSessionId,
    'res.users',
    'read',
    [[uid], [...SCOPE_FIELDS]],
  )

  const entries = await Promise.all(
    (Object.keys(ROLE_GROUPS) as Array<keyof SchoolRoles>).map(async (role) => {
      const held = await rawCallKw<boolean>(odooSessionId, 'res.users', 'has_group', [
        [uid],
        ROLE_GROUPS[role],
      ])
      return [role, held] as const
    }),
  )

  const scope = record as unknown as SchoolScope
  return {
    ...scope,
    id: uid,
    roles: Object.fromEntries(entries) as unknown as SchoolRoles,
  }
}

export async function login(loginName: string, password: string): Promise<AppSession> {
  const { result, sessionId } = await jsonRpc<{ uid?: number; name?: string } | false>(
    '/web/session/authenticate',
    { db: odooConfig.database, login: loginName, password },
  )

  // Odoo raises AccessDenied on bad credentials, which the transport has
  // already normalised. A falsy uid without an error means the same thing.
  if (!result || !result.uid || !sessionId) {
    throw new OdooError('UNAUTHENTICATED', 'Your username or password is incorrect.', 401)
  }

  const user = await loadCurrentUser(sessionId, result.uid)
  const session: AppSession = {
    odooSessionId: sessionId,
    uid: result.uid,
    login: user.login,
    name: user.name,
    user,
  }
  await writeSession(session)
  return session
}

/**
 * Clearing our cookie is not enough — the Odoo session would stay alive until
 * it expired. Destroy it there first, then locally.
 */
export async function logout(): Promise<void> {
  const session = await readSession()
  if (session) {
    try {
      await jsonRpc('/web/session/destroy', {}, session.odooSessionId)
    } catch {
      // A failed remote destroy must not trap the user in a signed-in state.
    }
  }
  await clearSession()
}

/** Session or null. Use in layouts that render for both states. */
export async function getSession(): Promise<AppSession | null> {
  return readSession()
}

/**
 * Session or redirect to /login. This is a convenience for rendering, not a
 * security boundary: every Odoo call is authorised by Odoo regardless.
 */
export async function requireSession(): Promise<AppSession> {
  const session = await readSession()
  if (!session) redirect('/login')
  return session
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await readSession())?.user ?? null
}
