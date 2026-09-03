import { requireSession } from '@/lib/odoo/auth'
import { resolveScope } from '@/lib/odoo/models/overview'
import { AdminDashboard } from './admin-dashboard'
import { DirectorDashboard } from './director-dashboard'
import { FrontOfficeDashboard } from './front-office-dashboard'
import { GeneralDashboard } from './general-dashboard'
import { RegistrarDashboard } from './registrar-dashboard'
import { TeacherDashboard } from './teacher-dashboard'

export const metadata = { title: 'Dashboard · Async School' }

/**
 * One route, a different command centre per role.
 *
 * A shared page with role-aware tiles was the original shape, and it meant a
 * teacher landed on school-wide counts they could not act on while the thing
 * they actually needed — today's lessons and the mark lists waiting on them —
 * was three clicks away. Each role now gets the screen its job implies.
 *
 * Order matters where somebody holds more than one group: the strongest wins,
 * matching `primaryRoleLabel`, so an administrator sees the widest view rather
 * than whichever dashboard happened to be checked first. Administrator and
 * Director are no longer the same screen — they have very different access and
 * very different jobs, which is covered in the note on each.
 *
 * None of this is authorisation. Every read underneath runs as the signed-in
 * user and Odoo refuses whatever it refuses; the role only decides which
 * questions are worth asking.
 */
export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  const [{ user }, params] = await Promise.all([requireSession(), searchParams])
  const { roles } = user

  /*
    The academic scope is resolved once, here, and handed down. Every panel
    then filters on the same year and term — a dashboard whose halves disagreed
    about which term they were showing would be worse than one with no filter
    at all.
  */
  const scope = await resolveScope({
    year: single(params.year),
    term: single(params.term),
  })

  if (roles.isAdmin) return <AdminDashboard user={user} scope={scope} />
  if (roles.isDirector) return <DirectorDashboard user={user} scope={scope} />
  if (roles.isRegistrar) return <RegistrarDashboard user={user} scope={scope} />
  if (roles.isFrontOffice) return <FrontOfficeDashboard user={user} scope={scope} />
  if (roles.isTeacher) return <TeacherDashboard user={user} scope={scope} />
  return <GeneralDashboard user={user} roles={roles} scope={scope} />
}

/** `?year=1&year=2` is a string[]; only one year can be in scope. */
function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
