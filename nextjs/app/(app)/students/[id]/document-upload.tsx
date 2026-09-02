'use client'

import { useActionState } from 'react'
import { uploadStudentDocumentAction, type UploadState } from '../actions'

/**
 * Attach a registration document.
 *
 * The file goes Browser → Next.js → Odoo. It is never handed to storage
 * directly: these binaries carry a registrar-only field group that only Odoo
 * can evaluate, and `school.document` records a checksum and a verification
 * state that a direct upload would bypass.
 */
export function DocumentUpload({
  studentId,
  field,
  label,
  attached,
  hint,
  canWrite,
}: {
  studentId: number
  field: 'birth_certificate' | 'previous_grade_document'
  label: string
  attached: string | false
  hint?: string
  canWrite: boolean
}) {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(
    uploadStudentDocumentAction,
    {},
  )
  const inputId = `${field}-file`

  return (
    <div className="border-t border-silver py-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-graphite">{label}</span>
        <span className="min-w-0 break-all text-[12px] text-slate">
          {attached ? attached : <span className="text-stone">Not attached</span>}
        </span>
      </div>
      {hint ? <p className="mt-0.5 text-[11px] text-stone">{hint}</p> : null}

      {canWrite ? (
        <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="field" value={field} />
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
          <input
            id={inputId}
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            required
            className="max-w-[220px] flex-1 text-[12px] text-slate file:mr-2 file:rounded-[9999px] file:border file:border-silver file:bg-white file:px-3 file:py-1 file:text-[12px] file:text-graphite hover:file:bg-paper"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] hover:bg-paper disabled:opacity-50"
          >
            {pending ? 'Uploading…' : attached ? 'Replace' : 'Upload'}
          </button>
        </form>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-2 text-[11px] text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="mt-2 text-[11px] text-action-blue">
          {state.ok}
        </p>
      ) : null}
    </div>
  )
}
