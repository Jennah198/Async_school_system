import { redirect } from 'next/navigation'
import { getSession } from '@/lib/odoo/auth'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in · Async School' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const expired = params.expired === '1'

  // Only bounce to the dashboard when the visitor is genuinely signed in.
  // Arriving here after an expired Odoo session must not loop back.
  if (!expired && (await getSession())) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8">
          <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-[8px] bg-ink">
            <span className="font-display text-[15px] leading-none text-white">A</span>
          </div>
          <h1 className="text-[24px] leading-tight">Sign in</h1>
          <p className="mt-1.5 text-[14px] text-slate">
            Use the account your school administrator issued you.
          </p>
        </div>
        {expired ? (
          <p
            role="status"
            className="mb-4 rounded-[8px] bg-info-bg px-3 py-2 text-[13px] text-action-blue"
          >
            Your session expired and you have been signed out. Please sign in again.
          </p>
        ) : null}
        <LoginForm />
      </div>
    </main>
  )
}
