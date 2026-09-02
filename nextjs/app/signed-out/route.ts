import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/odoo/config'

/**
 * Clears a stale session and returns the user to the login form.
 *
 * This is a Route Handler rather than a page because a Server Component
 * cannot set or delete cookies during render — which is exactly the situation
 * that produces a dead end: the app cookie is still valid, the Odoo session
 * behind it has expired, and every page throws with no way to sign in again.
 */
export async function GET(request: Request) {
  const url = new URL('/login?expired=1', request.url)
  const response = NextResponse.redirect(url)
  response.cookies.delete(SESSION_COOKIE)
  return response
}
