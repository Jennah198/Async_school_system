import 'server-only'

/**
 * Server-only Odoo configuration.
 *
 * Nothing here may be referenced from a client component, and none of these
 * names may ever be prefixed NEXT_PUBLIC_ — the browser must not learn the
 * Odoo host, the database name, or anything that would let it call Odoo
 * directly. Odoo serves no CORS headers (verified against staging), so a
 * browser-direct call would fail anyway; keeping the config server-side means
 * it is never even attempted.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in before starting the app.`,
    )
  }
  return value
}

export const odooConfig = {
  /** e.g. https://async-school-staging.onrender.com — never production. */
  get baseUrl(): string {
    return required('ODOO_BASE_URL').replace(/\/+$/, '')
  },
  get database(): string {
    return required('ODOO_DB')
  },
  /** Signs the app's own session cookie. Unrelated to any Odoo secret. */
  get sessionSecret(): string {
    const secret = required('SESSION_SECRET')
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters.')
    }
    return secret
  },
  /**
   * Staging on Render's free plan sleeps after ~15 minutes and cold-starts in
   * roughly a minute. Warm requests measured ~0.3s. A short timeout would make
   * the first request of the day look like an outage.
   */
  timeoutMs: Number(process.env.ODOO_TIMEOUT_MS ?? 60_000),
} as const

export const SESSION_COOKIE = 'school_session'
