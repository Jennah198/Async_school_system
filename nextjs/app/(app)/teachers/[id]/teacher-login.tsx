'use client'

import { useActionState, useState } from 'react'
import { Badge, Button } from '@/components/ui'
import { INPUT_CLASS } from '@/components/ui/form'
import {
  createTeacherLoginAction,
  setTeacherPasswordAction,
  type TeacherFormState,
} from '../actions'

/**
 * Provisioning the teaching login, and setting its password.
 *
 * Odoo owns both. Creating calls `action_create_login_user`; setting a password
 * writes `login_password`, a non-stored field whose inverse hands the value to
 * `res.users.password` and creates the user if there is none.
 *
 * The password field exists because emailing a set-password link only works
 * where an outgoing mail server is configured. Without one the account is
 * created with no password and the teacher cannot sign in — which is exactly
 * what happened before this was added.
 */
export function TeacherLogin({
  teacherId,
  userLabel,
  canWrite,
}: {
  teacherId: number
  userLabel: string
  canWrite: boolean
}) {
  const [state, formAction, pending] = useActionState<TeacherFormState, FormData>(
    createTeacherLoginAction,
    {},
  )

  if (userLabel) {
    return (
      <div className="space-y-3">
        <Badge tone="live">Login active</Badge>
        <p className="text-[13px] text-graphite">{userLabel}</p>
        {canWrite ? <SetPassword teacherId={teacherId} label="Reset password" /> : null}
      </div>
    )
  }

  if (!canWrite) {
    return <p className="text-[12px] text-slate">No login yet. Your role cannot create one.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate">
        This teacher has no Odoo login, so they cannot sign in to see their classes.
      </p>
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-danger-bg px-3 py-2 text-[12px] text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-[8px] bg-info-bg px-3 py-2 text-[12px] text-action-blue">
          {state.ok}
        </p>
      ) : null}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="id" value={teacherId} />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-graphite">
            Initial password
          </span>
          <input
            type="password"
            name="login_password"
            autoComplete="new-password"
            className={INPUT_CLASS}
            placeholder="Leave blank to email a link"
          />
        </label>
        {state.fieldErrors?.login_password ? (
          <p role="alert" className="text-[11px] text-danger">
            {state.fieldErrors.login_password}
          </p>
        ) : null}
        <Button type="submit" size="sm" icon="user" pending={pending} className="w-full">
          {pending ? 'Creating…' : 'Create teaching login'}
        </Button>
      </form>
    </div>
  )
}

/** Set or reset the password on a login that already exists. */
function SetPassword({ teacherId, label }: { teacherId: number; label: string }) {
  const [state, formAction, pending] = useActionState<TeacherFormState, FormData>(
    setTeacherPasswordAction,
    {},
  )
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="ghost" size="sm" icon="user" onClick={() => setOpen(true)} className="w-full">
        {label}
      </Button>
    )
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={teacherId} />
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-graphite">New password</span>
        <input
          type="password"
          name="login_password"
          autoComplete="new-password"
          required
          className={INPUT_CLASS}
        />
      </label>
      {state.fieldErrors?.login_password ? (
        <p role="alert" className="text-[11px] text-danger">
          {state.fieldErrors.login_password}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-danger-bg px-3 py-2 text-[12px] text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-[8px] bg-info-bg px-3 py-2 text-[12px] text-action-blue">
          {state.ok}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" pending={pending}>
          {pending ? 'Saving…' : 'Set password'}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] hover:bg-paper"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
