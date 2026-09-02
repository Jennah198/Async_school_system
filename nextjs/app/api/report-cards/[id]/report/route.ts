import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/odoo/auth'
import { readSession } from '@/lib/odoo/session'
import { odooConfig } from '@/lib/odoo/config'
import { toOdooError } from '@/lib/odoo/errors'

/**
 * Stream a report card PDF.
 *
 * Odoo renders it; this only forwards the signed-in user's own session, so the
 * record rules that decide who may read a card decide who may print one. The
 * bytes travel Browser → Next.js → Odoo like every other call — the Odoo host
 * is never exposed to the browser.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession()

  const { id } = await params
  const cardId = Number(id)

  if (!Number.isInteger(cardId) || cardId <= 0) {
    return NextResponse.json({ error: 'Invalid report card ID.' }, { status: 400 })
  }

  const session = await readSession()

  if (!session) {
    return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 })
  }

  const reportName = 'school_management.report_school_report_card'

  try {
    const response = await fetch(
      `${odooConfig.baseUrl}/report/pdf/${reportName}/${cardId}`,
      {
        headers: {
          Cookie: `session_id=${session.odooSessionId}`,
        },
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      throw new Error(`Odoo report request failed with HTTP ${response.status}.`)
    }

    const pdf = await response.arrayBuffer()

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    })
  } catch (cause) {
    const error = toOdooError(cause)

    return NextResponse.json({ error: error.message }, { status: error.status || 502 })
  }
}
