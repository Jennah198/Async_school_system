'use client'

import { useActionState } from 'react'
import { previewStaffImportAction, runStaffImportAction, type ImportState } from '../import-actions'
import type { StaffImportReport } from '@/lib/odoo/models/staff'

const FINDINGS: Array<{ key: keyof StaffImportReport; label: string; tone: 'warn' | 'note' }> = [
  { key: 'unknown_department', label: 'Unknown department', tone: 'warn' },
  { key: 'unknown_employment_status', label: 'Unknown employment status', tone: 'warn' },
  { key: 'unknown_gender', label: 'Unknown gender', tone: 'warn' },
  { key: 'invalid_fayda', label: 'Invalid Fayda ID', tone: 'warn' },
  { key: 'duplicate_source_ids', label: 'Duplicate staff ID in the file', tone: 'warn' },
  { key: 'duplicate_source_names', label: 'Duplicate name in the file', tone: 'note' },
  { key: 'already_imported', label: 'Already imported', tone: 'note' },
  { key: 'name_matches_existing', label: 'Name matches existing staff', tone: 'note' },
  { key: 'unmapped_source_columns', label: 'Columns with nowhere to go', tone: 'note' },
]

function Findings({ report }: { report: StaffImportReport }) {
  const rows = FINDINGS.map((finding) => ({
    ...finding,
    values: (report[finding.key] as string[] | undefined) ?? [],
  })).filter((row) => row.values.length > 0)

  return (
    <div className="space-y-3 rounded-[8px] border border-silver p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        <span>
          <span className="text-stone">Rows read</span>{' '}
          <span className="tabular font-medium text-graphite">{report.source_rows}</span>
        </span>
        <span>
          <span className="text-stone">Will be created</span>{' '}
          <span className="tabular font-medium text-graphite">{report.importable.length}</span>
        </span>
        <span>
          <span className="text-stone">Skipped</span>{' '}
          <span className="tabular font-medium text-graphite">
            {report.source_rows - report.importable.length}
          </span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[12px] text-slate">Every row is importable.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={String(row.key)} className="text-[12px]">
              <span className={row.tone === 'warn' ? 'font-medium text-danger' : 'font-medium text-graphite'}>
                {row.label}
              </span>{' '}
              <span className="text-stone">({row.values.length})</span>
              <span className="ml-1 text-slate">&mdash; {row.values.slice(0, 8).join(', ')}</span>
              {row.values.length > 8 ? <span className="text-stone"> and more</span> : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-stone">
        A row Odoo cannot place is reported and skipped. No department, status or gender is ever
        invented to accommodate the file.
      </p>
    </div>
  )
}

export function StaffImportForm() {
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(
    previewStaffImportAction,
    {},
  )
  const [imported, importAction, importing] = useActionState<ImportState, FormData>(
    runStaffImportAction,
    {},
  )

  const report = imported.report ?? preview.report

  return (
    <div className="space-y-5">
      <form action={previewAction} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-graphite">
            Staff CSV <span className="text-danger">*</span>
          </span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="block w-full text-[13px] text-graphite file:mr-3 file:rounded-[9999px] file:border file:border-silver file:bg-white file:px-3.5 file:py-1.5 file:text-[12px] file:font-medium hover:file:bg-paper"
          />
        </label>

        <p className="text-[11px] text-stone">
          Columns read: staff_id, first_name, last_name, gender, department, employment_status,
          hire_date. Anything else is reported rather than dropped quietly.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={previewing}
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] font-medium hover:bg-paper disabled:opacity-50"
          >
            {previewing ? 'Checking…' : 'Check the file'}
          </button>
          {preview.filename ? (
            <span className="text-[12px] text-stone">{preview.filename}</span>
          ) : null}
          {preview.error ? (
            <span role="alert" className="text-[12px] text-danger">
              {preview.error}
            </span>
          ) : null}
        </div>
      </form>

      {report ? <Findings report={report} /> : null}

      {preview.report && preview.payload && !imported.ok ? (
        <form action={importAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="payload" value={preview.payload} />
          <button
            type="submit"
            disabled={importing || preview.report.importable.length === 0}
            className="rounded-[9999px] bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
          >
            {importing
              ? 'Importing…'
              : `Import ${preview.report.importable.length} ${preview.report.importable.length === 1 ? 'record' : 'records'}`}
          </button>
          <span className="text-[12px] text-stone">
            Only the rows above are created, and they land in draft.
          </span>
          {imported.error ? (
            <span role="alert" className="text-[12px] text-danger">
              {imported.error}
            </span>
          ) : null}
        </form>
      ) : null}

      {imported.ok ? (
        <p role="status" className="text-[13px] text-action-blue">
          {imported.ok}
        </p>
      ) : null}
    </div>
  )
}
