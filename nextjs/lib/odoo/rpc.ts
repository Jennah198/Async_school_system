import 'server-only'
import { odooConfig } from './config'
import { normaliseOdooError, OdooError, toOdooError } from './errors'

/**
 * Low-level Odoo transport. Server-only, no React, no cookies() — the caller
 * supplies the Odoo session id. Everything above this file works in terms of
 * models and methods, never URLs.
 *
 * Two transports exist and both were verified against staging:
 *
 *   /web/dataset/call_kw    session cookie   — used for every human request
 *   /json/2/<model>/<method> Bearer API key  — machine-to-machine only
 *
 * Human traffic uses the session because Odoo 19 cannot mint an API key
 * without an interactive password confirmation, and the keys it does mint are
 * required to expire. A login form can only produce a session.
 */

interface JsonRpcEnvelope<T> {
  jsonrpc: '2.0'
  id?: string | number | null
  result?: T
  error?: {
    message?: string
    data?: { name?: string; message?: string; debug?: string }
  }
}

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), odooConfig.timeoutMs)
  try {
    return await fetch(`${odooConfig.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      // Odoo data is per-user and record-rule scoped. Caching it in Next's
      // data cache would risk serving one user's rows to another.
      cache: 'no-store',
      redirect: 'manual',
    })
  } finally {
    clearTimeout(timer)
  }
}

/** JSON-RPC over a session cookie. Odoo answers 200 even for errors. */
export async function jsonRpc<T>(
  path: string,
  params: Record<string, unknown>,
  sessionId?: string,
): Promise<{ result: T; sessionId?: string }> {
  let response: Response
  try {
    response = await postJson(
      path,
      { jsonrpc: '2.0', method: 'call', params },
      sessionId ? { Cookie: `session_id=${sessionId}` } : {},
    )
  } catch (cause) {
    throw toOdooError(cause)
  }

  if (response.status >= 500) {
    throw new OdooError(
      'UPSTREAM_UNAVAILABLE',
      'The school system is temporarily unavailable.',
      502,
      `HTTP ${response.status} from ${path}`,
    )
  }

  let envelope: JsonRpcEnvelope<T>
  try {
    envelope = (await response.json()) as JsonRpcEnvelope<T>
  } catch {
    throw new OdooError(
      'UPSTREAM_UNAVAILABLE',
      'The school system returned an unreadable response.',
      502,
      `non-JSON body from ${path}`,
    )
  }

  if (envelope.error) throw normaliseOdooError(envelope.error)

  return { result: envelope.result as T, sessionId: readSessionCookie(response) }
}

/** Odoo issues a fresh session_id on authenticate; capture it. */
function readSessionCookie(response: Response): string | undefined {
  const raw = response.headers.getSetCookie?.() ?? []
  for (const cookie of raw) {
    const match = /(?:^|;\s*)session_id=([^;]+)/.exec(cookie)
    if (match) return match[1]
  }
  return undefined
}

/**
 * `call_kw` — the method call every screen ultimately makes.
 *
 * Always pass an explicit field list from the caller. A bare search_read fails
 * with AccessError for anyone below base.group_system, because school.staff
 * carries system-only fields (address, notes) alongside the readable ones.
 */
export async function rawCallKw<T>(
  sessionId: string,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const { result } = await jsonRpc<T>(
    '/web/dataset/call_kw',
    { model, method, args, kwargs },
    sessionId,
  )
  return result
}

/**
 * JSON-2 with a Bearer API key. Not used for human traffic — kept for future
 * machine-to-machine jobs. Unlike call_kw this returns the method's raw value
 * and uses real HTTP status codes.
 */
export async function jsonTwo<T>(
  apiKey: string,
  model: string,
  method: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  let response: Response
  try {
    response = await postJson(`/json/2/${model}/${method}`, body, {
      Authorization: `Bearer ${apiKey}`,
    })
  } catch (cause) {
    throw toOdooError(cause)
  }

  const text = await response.text()
  if (response.ok) return (text ? JSON.parse(text) : null) as T

  let payload: { name?: string; message?: string; debug?: string } = {}
  try {
    payload = JSON.parse(text)
  } catch {
    /* fall through to UNKNOWN */
  }
  throw normaliseOdooError({ data: payload })
}
