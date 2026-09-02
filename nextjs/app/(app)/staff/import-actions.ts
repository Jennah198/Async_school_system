'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import {
  dryRunStaffImport,
  runStaffImport,
  type StaffImportReport,
} from '@/lib/odoo/models/staff'

export interface ImportState {
  error?: string
  ok?: string
  report?: StaffImportReport
  /** The file the preview ran against, so Import needs no second upload. */
  payload?: string
  filename?: string
}

/** A staff list is a small file; anything larger is not this. */
const MAX_BYTES = 2 * 1024 * 1024

async function readCsv(form: FormData): Promise<{ base64: string; name: string } | string> {
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return 'Choose a CSV file.'
  if (file.size > MAX_BYTES) return 'That file is larger than 2 MB.'
  if (!file.name.toLowerCase().endsWith('.csv')) return 'That file is not a .csv.'

  const bytes = Buffer.from(await file.arrayBuffer())
  return { base64: bytes.toString('base64'), name: file.name }
}

/**
 * Analyse an uploaded staff CSV. Writes nothing.
 *
 * Odoo does the validating — department, employment status, gender and Fayda
 * format against the live vocabularies, plus the staff that already exist —
 * so the preview and the import can never disagree.
 */
export async function previewStaffImportAction(
  _previous: ImportState,
  form: FormData,
): Promise<ImportState> {
  await requireSession()

  const read = await readCsv(form)
  if (typeof read === 'string') return { error: read }

  try {
    const report = await dryRunStaffImport(read.base64)
    return { report, payload: read.base64, filename: read.name }
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }
}

/**
 * Import the rows the preview cleared.
 *
 * Only rows in `importable` are created, and they land in Draft — activation
 * needs a birth date, phone, job title and responsibility no source file
 * carries. Odoo requires a system administrator.
 */
export async function runStaffImportAction(
  _previous: ImportState,
  form: FormData,
): Promise<ImportState> {
  await requireSession()

  const payload = String(form.get('payload') ?? '')
  if (!payload) return { error: 'Preview the file again before importing.' }

  let report: StaffImportReport
  try {
    report = await runStaffImport(payload)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/staff')
  const created = report.created?.length ?? 0
  return {
    report,
    ok: `${created} staff ${created === 1 ? 'record' : 'records'} created in draft.`,
  }
}
