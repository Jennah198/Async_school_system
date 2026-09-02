'use server'

import { redirect } from 'next/navigation'
import { login, logout } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { landingPath } from '@/lib/navigation'

export interface LoginState {
  error?: string
}

/**
 * The password crosses this boundary once, is forwarded to Odoo, and is never
 * stored or logged. What returns is an Odoo session id, sealed server-side
 * into an httpOnly cookie by `login()`.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const loginName = String(formData.get('login') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!loginName || !password) {
    return { error: 'Enter both your email and password.' }
  }

  let session
  try {
    session = await login(loginName, password)
  } catch (cause) {
    // Only the normalised message — never Odoo's traceback.
    return { error: toOdooError(cause).message }
  }

  // The groups Odoo just resolved decide the first page — a teacher's open
  // mark lists, an exam officer's approval queue — rather than everyone
  // landing on an overview most roles have to click straight through.
  redirect(landingPath(session.user.roles))
}

export async function logoutAction(): Promise<void> {
  await logout()
  redirect('/login')
}
