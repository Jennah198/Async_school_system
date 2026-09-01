import 'server-only'
import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
import { odooConfig, SESSION_COOKIE } from './config'
import type { CurrentUser } from './types'

/**
 * The application's own session.
 *
 * The browser holds one opaque, encrypted, httpOnly cookie. Inside it sits the
 * Odoo `session_id` — which is a credential — plus the minimum identity the UI
 * needs to render. The Odoo session id itself never reaches client JavaScript,
 * and the browser never talks to Odoo.
 *
 * Odoo's own session cookie is set without the Secure flag (observed on
 * staging). That cookie stays server-side here; the cookie we hand the browser
 * sets Secure in production ourselves.
 */

const ALG = 'HS256'
const MAX_AGE_SECONDS = 60 * 60 * 8 // one school day

export interface AppSession {
  /** Odoo session_id. A credential — server-side only, never serialised out. */
  odooSessionId: string
  uid: number
  login: string
  name: string
  /** Cached to avoid an Odoo round trip on every navigation. */
  user: CurrentUser
}

function key(): Uint8Array {
  return new TextEncoder().encode(odooConfig.sessionSecret)
}

async function seal(session: AppSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key())
}

async function unseal(token: string): Promise<AppSession | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: [ALG] })
    const candidate = payload as unknown as AppSession
    if (!candidate?.odooSessionId || !candidate?.uid) return null
    return candidate
  } catch {
    // Expired, tampered with, or signed by a rotated secret. All mean
    // "not signed in" — never a 500.
    return null
  }
}

/**
 * `Secure` is on by default and must stay on wherever the app is reachable
 * over HTTPS — which is every real deployment.
 *
 * It is overridable only because `next start` forces NODE_ENV=production, so a
 * local run over plain http://localhost would set a Secure cookie the browser
 * then declines to send back on same-site POSTs, and every server action would
 * look like a signed-out user. Set SESSION_COOKIE_SECURE=false for that case
 * and nowhere else.
 */
function secureCookie(): boolean {
  return process.env.SESSION_COOKIE_SECURE !== 'false'
}

export async function writeSession(session: AppSession): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, await seal(session), {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function readSession(): Promise<AppSession | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return token ? unseal(token) : null
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
