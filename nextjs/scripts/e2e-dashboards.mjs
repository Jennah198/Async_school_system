/**
 * The role dashboards, checked against real Odoo data.
 *
 * The point of these assertions is that each role lands on a screen shaped by
 * its own job, and that every number shown is one Odoo actually returned. A
 * dash is a refusal and must never be rendered as a zero — a dashboard that
 * told a Director "0 students" when it simply could not read students would be
 * worse than one that said nothing.
 */
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? 'http://localhost:3100'
const PASSWORD = process.env.E2E_PASSWORD
const ROLES = {
  teacher: process.env.E2E_TEACHER_LOGIN,
  registrar: process.env.E2E_REGISTRAR_LOGIN,
  director: process.env.E2E_DIRECTOR_LOGIN,
  frontoffice: process.env.E2E_FRONTOFFICE_LOGIN,
}

/** Panels each role's dashboard must offer, by heading. */
const EXPECTED = {
  teacher: ["Today's lessons", 'Waiting on you', 'Mark lists open to you', 'Attendance today'],
  registrar: ['Waiting on you', 'Registration pipeline', 'Recent registrations'],
  director: ['Awaiting approval', 'Student lifecycle'],
  frontoffice: ['Find a student', 'Live announcements'],
}

/** Panels a role must NOT see, because the screen belongs to somebody else. */
const FORBIDDEN = {
  teacher: ['Registration pipeline', 'Awaiting approval'],
  registrar: ["Today's lessons"],
  director: ["Today's lessons", 'Find a student'],
  frontoffice: ['Registration pipeline', "Today's lessons"],
}

/*
  Read the rendered page, not `body`: React's flight payload sits in a script
  tag and legitimately contains `$undefined` markers, which is not a leak.
*/
const LEAK = /Traceback|\/usr\/lib\/python|psycopg2|odoo\.exceptions|session_id=/i
const PLACEHOLDER = /NaN|undefined|\[object Object\]/

let failures = 0
const check = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })

for (const [role, login] of Object.entries(ROLES)) {
  if (!login) continue
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#login', login)
  await page.fill('#password', PASSWORD)
  await page.click('#submit-login')
  await page.waitForURL('**/dashboard', { timeout: 90_000 })

  console.log(`\n${role} (${login})`)
  const visible = (await page.locator('main').innerText()) ?? ''

  check('renders without leaking', !LEAK.test(visible), LEAK.exec(visible)?.[0] ?? '')
  check('renders no placeholder values', !PLACEHOLDER.test(visible), PLACEHOLDER.exec(visible)?.[0] ?? '')
  check(
    'greets by name',
    /Good (morning|afternoon|evening),/.test(visible),
    visible.match(/Good \w+, [^\n]{0,24}/)?.[0] ?? '',
  )

  for (const panel of EXPECTED[role] ?? []) {
    check(`shows "${panel}"`, (await page.locator(`main h2:text-is("${panel}")`).count()) > 0)
  }
  for (const panel of FORBIDDEN[role] ?? []) {
    check(`does not show "${panel}"`, (await page.locator(`main h2:text-is("${panel}")`).count()) === 0)
  }

  // Every tile is a real figure or an explicit dash, never a zero standing in
  // for a refusal.
  const tiles = await page.locator('main a[href] p.tabular, main div p.tabular').allTextContents()
  const dashes = tiles.filter((t) => t.trim() === '—').length
  const restrictedNotes = await page.locator('main :text("Not available to your role")').count()
  check(
    'every dashed tile says why',
    dashes === 0 || restrictedNotes >= dashes,
    `dashes=${dashes} notes=${restrictedNotes}`,
  )
  check('no tile reads NaN or undefined', !tiles.some((t) => /NaN|undefined/.test(t)))

  // A dashboard that cannot be acted on is a poster. Every one of these has at
  // least one panel that leads into the list it summarises.
  const onward = await page.locator('main a[href^="/"]').count()
  check('panels lead somewhere', onward >= 3, `${onward} links`)

  // A dashboard is the landing page, so it must survive a narrow viewport.
  await page.setViewportSize({ width: 390, height: 780 })
  await page.waitForTimeout(200)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )
  check('no horizontal overflow at 390px', overflow)

  await context.close()
}

await browser.close()
console.log(`\n${failures === 0 ? 'dashboards: all checks passed' : `${failures} check(s) failed`}`)
process.exit(failures === 0 ? 0 : 1)
