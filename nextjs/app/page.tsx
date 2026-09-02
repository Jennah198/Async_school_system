import { redirect } from 'next/navigation'
import { getSession } from '@/lib/odoo/auth'
import { landingPath } from '@/lib/navigation'

export default async function RootPage() {
  const session = await getSession()
  // The same first page a fresh sign-in would give, so the root and the login
  // bounce never disagree about where someone's work starts.
  redirect(session ? landingPath(session.user.roles) : '/login')
}
