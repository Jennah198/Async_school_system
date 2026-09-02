import { redirect } from 'next/navigation'
import { getSession } from '@/lib/odoo/auth'

export default async function RootPage() {
  redirect((await getSession()) ? '/dashboard' : '/login')
}
