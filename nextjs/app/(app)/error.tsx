'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Backstop for anything that escapes a page's own error handling.
 *
 * Its most important job is offering a way out: an expired session used to
 * leave the user on a thrown error with no route back to the login form.
 * `/signed-out` clears the stale cookie and returns them there.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side detail is deliberately not rendered — only logged.
    console.error('Unhandled application error', error.digest ?? error.message)
  }, [error])

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-[20px] leading-tight">Something went wrong</h1>
      <p className="mt-2 text-[13px] text-slate">
        The page could not be loaded. If you have been away for a while your session may have
        expired.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite"
        >
          Try again
        </button>
        <Link
          href="/signed-out"
          className="rounded-[9999px] border border-silver px-5 py-2.5 text-[13px] hover:bg-paper"
        >
          Sign in again
        </Link>
      </div>
    </div>
  )
}
