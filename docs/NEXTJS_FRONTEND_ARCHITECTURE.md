# Next.js frontend architecture

How the Next.js application in [`/nextjs`](../nextjs) sits in front of the
existing Odoo 19 `school_management` module.

Odoo remains the backend, the business-logic engine and the authorisation
system. Next.js is the user-facing application and the only thing the browser
talks to.

---

## 1. Topology

```
Browser
   │  one encrypted, httpOnly cookie — no Odoo credential, no Odoo host
   ▼
Next.js  (App Router, server components + server actions)
   │  lib/odoo/* — the only place that knows Odoo exists
   ▼
Odoo 19  /web/session/authenticate  →  /web/dataset/call_kw
   │  ACLs → record rules → field groups → constraints
   ▼
Neon PostgreSQL
```

The browser never reaches Odoo. Odoo serves **no CORS headers** (verified on
both production and staging), so a browser-direct call would fail regardless —
but the config is server-only so it is never attempted. **Do not add CORS.**

---

## 2. Authentication

Session-based, not API keys. The reason is measured, not stylistic: Odoo 19
will not mint an API key without an interactive password re-confirmation
(`res.users.identitycheck`, whose password field does not survive across RPC
calls), and it *requires* every key to carry an expiry. A login form can only
produce a session.

```
POST /web/session/authenticate {db, login, password}
   → Odoo session_id
   → sealed into a JWT (jose, HS256) inside the `school_session` cookie
     httpOnly · secure in production · sameSite=lax · 8h
```

Logout destroys the Odoo session (`/web/session/destroy`) **and** clears the
cookie. Clearing only the cookie would leave a live Odoo session behind.

JSON-2 (`POST /json/2/<model>/<method>`, `Authorization: Bearer`) is
implemented in `rpc.ts` as `jsonTwo()` but unused by human traffic. It is the
right transport for future machine-to-machine jobs.

---

## 3. Layout of the integration layer

| File | Responsibility |
|---|---|
| `lib/odoo/config.ts` | Server-only env. Never `NEXT_PUBLIC_*`. |
| `lib/odoo/errors.ts` | Normalises Odoo exceptions to `{code, message}`. **Strips `debug`.** |
| `lib/odoo/rpc.ts` | Transport only: `call_kw` over a session, `jsonTwo` over a key. |
| `lib/odoo/session.ts` | Seals/opens the app cookie. |
| `lib/odoo/auth.ts` | `login`, `logout`, `requireSession`, `getCurrentUser`. |
| `lib/odoo/client.ts` | `searchRead`, `readOne`, `readGroup`, `hasAccess`, `callAction`. |
| `lib/odoo/models/school.ts` | Typed per-model services with explicit field lists. |
| `lib/navigation.ts` | Role-aware nav, encoding the *measured* permission matrix. |

Nothing above `lib/odoo/` knows an Odoo URL, a database name, or a session id.

---

## 4. Model → capability → role → route

Coverage below reflects what is **implemented today**, not the full domain.

| Odoo model | Capability | Roles that can actually use it | Route | Status |
|---|---|---|---|---|
| `res.users` | Sign in, identity, scope | all | `/login` | ✅ |
| — | Role dashboard | all | `/dashboard` | ✅ |
| `school.student` | Student list, search, paging | Registrar, Teacher (own classes), Admin, Exam Officer | `/students` | ✅ list |
| `school.staff` | Staff register | Registrar, Admin, Director, HR, Front Office, Teacher | `/staff` | ✅ list |
| `school.teacher` | Teacher profiles + workload | Registrar, Admin, Teacher, Director | `/teachers` | ✅ list |
| `school.academic.year` | Academic years | Registrar, Admin, Teacher | `/academic-years` | ✅ list |
| `school.class` | Classes | Registrar, Admin, Teacher, Director | `/classes` | ✅ list |
| `school.subject` | Subjects | Registrar, Admin, Teacher | `/subjects` | ✅ list |
| `school.teacher.assignment` | Teaching assignments | Registrar, Admin, Teacher, Director | `/assignments` | ✅ list |
| `school.mark` | Marks (Odoo-computed grades) | Teacher (own assignment), Exam Officer | `/marks` | ✅ list |
| `school.enrollment` | Enrolment lifecycle | Registrar, Director | `/enrollments` | ⛔ not built |
| `school.attendance` | Attendance capture | Teacher, Registrar | `/attendance` | ⛔ not built |
| `school.assessment` | Assessment state machine | Teacher, Exam Officer | `/assessments` | ⛔ not built |
| `school.report.card` | Report cards | Exam Officer, Director | `/report-cards` | ⛔ not built |
| `school.class.schedule` | Timetable | Teacher, Registrar | `/schedule` | ⛔ not built |
| `school.document` | Documents | Registrar, HR | `/documents` | ⛔ not built |
| `school.announcement` | Announcements | Registrar, Front Office | `/announcements` | ⛔ not built |
| `school.student.guardian` | Guardians | Registrar | `/students/:id/guardians` | ⛔ not built |

Also unbuilt: student and guardian portals. Those groups
(`group_school_student_portal`, `group_school_guardian_portal`) hold **zero ACL
rows**, so no portal experience is currently possible without backend work.

---

## 5. Rules the frontend follows

**Authorisation is Odoo's.** `lib/navigation.ts` hides doors, and `hasAccess()`
hides buttons, but neither is a security boundary. Every call is re-authorised
by Odoo as the signed-in user. There is no service account and no way to call
Odoo as anyone else.

**Explicit fields, always.** A bare `search_read` raises `AccessError` for
anyone below `base.group_system`, because `school.staff` carries system-only
fields alongside readable ones. It also pulls unstored computes that each run
their own queries per row. `searchRead()` therefore requires a field list.

**Fayda ID is never worked around.** It carries a field-level group. A teacher
requesting it gets 403 from Odoo, and that 403 is surfaced, not bypassed.

**Business logic stays in Odoo.** State transitions go through `callAction()`
to the model's own `action_*` method — never `write({state})`, which would skip
the sequence assignment, related-record creation and audit events those
transitions perform. Grades are displayed as Odoo computes them.

**No traceback ever reaches a browser.** `errors.ts` maps exceptions to a code
and a safe message and drops `debug`. Only `ValidationError`/`UserError`
messages pass through, because the module authors wrote those for end users.

---

## 6. Known backend limitations the UI must respect

Four record rules are ineffective because the matching ACL row is missing.
Confirmed by live test, not inference:

| Rule | Group | Model | Observed |
|---|---|---|---|
| `rule_student_all_director` | Director | `school.student` | 403 |
| `rule_student_contact_frontoffice` | Front Office | `school.student` | 403 |
| `rule_mark_all_registrar` | Registrar | `school.mark` | 403 |
| `rule_mark_all_director` | Director | `school.mark` | 403 |

The frontend does **not** pretend these work: those nav entries are hidden from
those roles, and dashboard tiles show "Not available to your role" rather than
failing. This needs a product/security decision — do not fix it in the
frontend.

Also outstanding on staging: `admin`/`admin` still works, and Odoo error
bodies still carry Python tracebacks (stripped at this boundary, but present
upstream).

---

## 7. Testing

```bash
npm run build          # includes TypeScript
npm run lint
npm run start          # then, against a running server:
node scripts/e2e-staging.mjs   http://localhost:3100   # authorisation edges
node scripts/route-sweep.mjs   http://localhost:3100   # every route, every role
```

Both scripts need `E2E_PASSWORD`, `E2E_TEACHER_LOGIN`, `E2E_REGISTRAR_LOGIN`
in the environment — no credential is committed. They drive the system Chrome
through `playwright-core`, so no browser download is required.

They target **staging only**. Never point them at production.
