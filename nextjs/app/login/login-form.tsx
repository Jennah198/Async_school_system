'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

const FIELD =
  'w-full rounded-[8px] border border-silver bg-white px-3 py-2.5 text-[14px] text-graphite ' +
  'placeholder:text-stone focus:border-action-blue focus:outline-none'

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {})

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label htmlFor="login" className="mb-1.5 block text-[13px] font-medium text-graphite">
          Email
        </label>
        <input
          id="login"
          name="login"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className={FIELD}
          placeholder="you@school.example"
          aria-describedby={state.error ? 'login-error' : undefined}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-graphite">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD}
          aria-describedby={state.error ? 'login-error' : undefined}
        />
      </div>

      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="rounded-[8px] bg-danger-bg px-3 py-2 text-[13px] text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <button
        id="submit-login"
        type="submit"
        disabled={pending}
        className="w-full rounded-[9999px] bg-ink px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-graphite disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="pt-2 text-center text-[12px] text-stone">
        Trouble signing in? Contact your school administrator.
      </p>
    </form>
  )
}
