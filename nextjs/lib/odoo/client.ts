import 'server-only'
import { redirect } from 'next/navigation'
import { OdooError, toOdooError } from './errors'
import { rawCallKw } from './rpc'
import { readSession } from './session'
import type { Domain, Page } from './types'

/**
 * An Odoo session can expire while this app's own cookie is still valid — the
 * app cookie lasts a school day, Odoo's does not. Every call therefore routes
 * an UNAUTHENTICATED answer to /signed-out, which clears the stale cookie and
 * returns the user to the login form. Without this the page simply threw and
 * offered no way back in.
 */
async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (cause) {
    if (cause instanceof OdooError && cause.code === 'UNAUTHENTICATED') {
      redirect('/signed-out')
    }
    throw cause
  }
}

/**
 * The Odoo client every screen uses.
 *
 * Resolves the caller's Odoo identity from the session cookie, so each request
 * executes as the real user and Odoo's record rules apply unchanged. There is
 * deliberately no way to call Odoo as anyone else: a shared service account
 * would collapse the whole authorisation model into application code.
 */

async function sessionId(): Promise<string> {
  const session = await readSession()
  if (!session) {
    throw new OdooError('UNAUTHENTICATED', 'You are not signed in.', 401)
  }
  return session.odooSessionId
}

/** Call any public model method as the current user. */
export async function callKw<T>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  return guarded(async () => rawCallKw<T>(await sessionId(), model, method, args, kwargs))
}

/**
 * Read a page of records.
 *
 * `fields` is required, not optional. Odoo refuses a bare read for anyone
 * below base.group_system on models carrying system-only fields, and asking
 * for everything would also pull unstored computes that each run their own
 * queries per row.
 */
export async function searchRead<T>(
  model: string,
  fields: readonly string[],
  options: {
    domain?: Domain
    limit?: number
    offset?: number
    order?: string
    context?: Record<string, unknown>
  } = {},
): Promise<Page<T>> {
  const { domain = [], limit = 50, offset = 0, order, context } = options
  return guarded(async () => {
  const sid = await sessionId()

  const [rows, total] = await Promise.all([
    rawCallKw<T[]>(sid, model, 'search_read', [], {
      domain,
      fields: [...fields],
      limit,
      offset,
      ...(order ? { order } : {}),
      ...(context ? { context } : {}),
    }),
    rawCallKw<number>(sid, model, 'search_count', [domain], context ? { context } : {}),
  ])

  return { rows, total, offset, limit }
  })
}

/** Read one record by id, or null when it is absent or out of scope. */
export async function readOne<T>(
  model: string,
  id: number,
  fields: readonly string[],
): Promise<T | null> {
  const rows = await callKw<T[]>(model, 'read', [[id], [...fields]])
  return rows[0] ?? null
}

export async function searchCount(model: string, domain: Domain = []): Promise<number> {
  return callKw<number>(model, 'search_count', [domain])
}

/** Grouped aggregate — the right primitive for dashboard tiles. */
export async function readGroup<T>(
  model: string,
  domain: Domain,
  fields: readonly string[],
  groupby: readonly string[],
): Promise<T[]> {
  return callKw<T[]>(model, 'read_group', [domain, [...fields], [...groupby]], { lazy: false })
}

/**
 * Whether the current user may perform an operation on a model.
 *
 * This is Odoo's own ACL check, used to decide whether to render a control.
 * It is not a substitute for authorisation: the create/write still goes to
 * Odoo, which checks again.
 */
export async function hasAccess(
  model: string,
  operation: 'read' | 'write' | 'create' | 'unlink',
): Promise<boolean> {
  try {
    // `has_access` is a record method, not @api.model, so call_kw expects
    // [ids, operation] — an empty id list asks about the model itself.
    return await callKw<boolean>(model, 'has_access', [[], operation])
  } catch (cause) {
    // A refusal is a legitimate answer, but a transport fault is not: log it
    // server-side rather than silently rendering the UI as "not permitted".
    // toOdooError rethrows framework errors, so an expired-session redirect
    // still reaches the user.
    console.error(`hasAccess(${model}, ${operation}) failed`, toOdooError(cause).code)
    return false
  }
}

export async function create(model: string, values: Record<string, unknown>): Promise<number> {
  return callKw<number>(model, 'create', [values])
}

export async function write(
  model: string,
  ids: number[],
  values: Record<string, unknown>,
): Promise<boolean> {
  return callKw<boolean>(model, 'write', [ids, values])
}

/**
 * Invoke a business method — action_activate, action_mark_approved, and the
 * rest of the school module's workflow transitions.
 *
 * State transitions go through here, never through `write({state: ...})`:
 * the transitions mint sequences, create related records, and write audit
 * events that a field write would skip.
 */
export async function callAction<T = unknown>(
  model: string,
  action: string,
  ids: number[],
  context?: Record<string, unknown>,
  /** Positional arguments the Odoo method takes after the recordset. */
  extraArgs: unknown[] = [],
): Promise<T> {
  return callKw<T>(model, action, [ids, ...extraArgs], context ? { context } : {})
}
