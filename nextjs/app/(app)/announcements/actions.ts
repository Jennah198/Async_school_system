'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import {
  createAnnouncement,
  type AnnouncementIntake,
  type AudienceType,
} from '@/lib/odoo/models/operations'

export interface AnnouncementFormState {
  error?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

/** Audience types whose value is a set of record ids rather than a code. */
const RECORD_AUDIENCES = new Set<string>([
  'teacher_group',
  'subject_group',
  'class_section',
  'branch_campus',
  'selected_staff',
])

/** `2026-09-11` plus `14:30` in Odoo's stored shape. Blank stays blank. */
function joinDateTime(date: string, time: string): string {
  if (!date) return ''
  return `${date} ${time || '00:00'}:00`
}

/**
 * Create an announcement in draft.
 *
 * Odoo resolves recipients and stamps the visibility window on publish, so
 * this only records the target. The audience value is required for every type
 * but `all_staff` — `_check_audience_values` rejects it otherwise, and the
 * message that produces is less useful than naming the field here.
 */
export async function createAnnouncementAction(
  _previous: AnnouncementFormState,
  form: FormData,
): Promise<AnnouncementFormState> {
  await requireSession()

  const text = (key: string) => String(form.get(key) ?? '').trim()
  const name = text('name')
  const message = text('message')
  const category = text('category')
  const priority = text('priority') || '0'
  const audienceType = text('audience_type') as AudienceType
  const link = text('link')

  const publishDatetime = joinDateTime(text('publish_date'), text('publish_time'))
  const expiryDatetime = joinDateTime(text('expiry_date'), text('expiry_time'))

  const values = {
    name,
    message,
    category,
    priority,
    audience_type: audienceType,
    link,
    publish_date: text('publish_date'),
    publish_time: text('publish_time'),
    expiry_date: text('expiry_date'),
    expiry_time: text('expiry_time'),
  }

  const isRecordAudience = RECORD_AUDIENCES.has(audienceType)
  const audienceValue: string | number[] = isRecordAudience
    ? form.getAll('audience_ids').map(Number).filter(Number.isFinite)
    : text('audience_code')

  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = 'A title is required.'
  if (!message) fieldErrors.message = 'A message is required.'
  if (!category) fieldErrors.category = 'Choose a category.'
  if (!audienceType) fieldErrors.audience_type = 'Choose an audience.'
  if (audienceType && audienceType !== 'all_staff' && audienceValue.length === 0) {
    fieldErrors.audience_value = 'Choose at least one audience value.'
  }
  if (expiryDatetime && publishDatetime && expiryDatetime <= publishDatetime) {
    fieldErrors.expiry_date = 'The expiry must be after the publish time.'
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values }

  const intake: AnnouncementIntake = {
    name,
    // Odoo's field is Html; a plain-text body still has to arrive as markup.
    message: `<p>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`,
    category,
    priority,
    audience_type: audienceType,
    audience_value: audienceValue,
    publish_datetime: publishDatetime || undefined,
    expiry_datetime: expiryDatetime || undefined,
    link: link || undefined,
  }

  let id: number
  try {
    id = await createAnnouncement(intake)
  } catch (cause) {
    return { error: toOdooError(cause).message, values }
  }

  revalidatePath('/announcements')
  redirect(`/announcements/${id}`)
}
