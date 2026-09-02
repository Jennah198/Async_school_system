import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/odoo/auth'
import { readSession } from '@/lib/odoo/session'
import { odooConfig } from '@/lib/odoo/config'
import { toOdooError } from '@/lib/odoo/errors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession()

  const { id } = await params
  const studentId = Number(id)

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: 'Invalid student ID.' }, { status: 400 })
  }

  const session = await readSession()

  if (!session) {
    return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 })
  }

  const reportName = 'school_management.report_school_student_document'

  try {
    const response = await fetch(
      `${odooConfig.baseUrl}/report/pdf/${reportName}/${studentId}`,
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

    return NextResponse.json(
      { error: error.message },
      { status: error.status || 502 },
    )
  }
}