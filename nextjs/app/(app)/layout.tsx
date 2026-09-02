import { AppShell } from '@/components/layout/app-shell'
import { requireSession } from '@/lib/odoo/auth'

/**
 * Every authenticated route renders inside this layout. The redirect is a
 * convenience so signed-out visitors land on the login form rather than an
 * error — it is not the security boundary. Odoo authorises each call.
 */
export default async function AuthenticatedLayout({ children }: LayoutProps<'/'>) {
  const session = await requireSession()
  return <AppShell user={session.user}>{children}</AppShell>
}
