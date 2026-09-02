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
| `lib/odoo/models/school.ts` | Typed read services with explicit field lists. |
| `lib/odoo/models/staff.ts` | Staff registration, activation and HR reads. |
| `lib/odoo/models/student.ts` | Student registration, guardians, enrolment, uploads. |
| `lib/odoo/models/assessment.ts` | Assessments, mark entry, report cards, promotion. |
| `lib/odoo/models/operations.ts` | Attendance, timetable, announcements, programs, documents, configuration. |
| `lib/odoo/workflows.ts` | **Allowlist** of every Odoo transition the UI may invoke. |
| `app/(app)/workflow-action.ts` | The single server action all transitions go through. |
| `lib/navigation.ts` | Role-aware nav, encoding the *measured* permission matrix. |

Nothing above `lib/odoo/` knows an Odoo URL, a database name, or a session id.

---

## 4. Model → capability → role → route

Coverage below reflects what is **implemented today**, not the full domain.

| Odoo model | Capability | Roles that can actually use it | Route | Status |
|---|---|---|---|---|
| `res.users` | Sign in, identity, scope | all | `/login` | ✅ |
| — | Role dashboard | all | `/dashboard` | ✅ |
| `school.student` | Student list, search, paging | Registrar, Teacher (own classes), Admin, Exam Officer, Director, Front Office | `/students` | ✅ list |
| `school.staff` | Staff register, registration, activation | Registrar, Admin, Director, HR, Front Office, Teacher | `/staff`, `/staff/new`, `/staff/[id]` | ✅ list · detail · **create** · **activate/suspend/deactivate/reset** |
| `school.staff.responsibility` | Responsibilities | as staff | `/staff/[id]` | ✅ read (seeded on create) |
| `school.staff.employment` | Employment history | HR, Admin only | `/staff/[id]` | ✅ read, degrades for others |
| `school.staff.daily.status` | Daily status | HR, Admin only | `/staff/[id]` | ✅ read, degrades for others |
| `school.job.title` | Job titles + granted responsibility | Registrar, Admin, Director, HR, Front Office, Teacher | (used by `/staff/new`) | ✅ read |
| `school.teacher` | Teacher profiles + workload | Registrar, Admin, Teacher, Exam Officer | `/teachers` | ✅ list |
| `school.academic.year` | Academic years | Registrar, Admin, Teacher | `/academic-years` | ✅ list |
| `school.class` | Classes | Registrar, Admin, Teacher, Exam Officer | `/classes` | ✅ list |
| `school.subject` | Subjects | Registrar, Admin, Teacher | `/subjects` | ✅ list |
| `school.teacher.assignment` | Teaching assignments | Registrar, Admin, Teacher | `/assignments` | ✅ list |
| `school.mark` | Marks (Odoo-computed grades) | Teacher (own assignment), Exam Officer, Registrar, Director | `/marks` | ✅ list |
| `school.enrollment` | Enrolment register + lifecycle | Registrar, Admin, Director, Teacher | `/enrollments`, `/enrollments/[id]` | ✅ list · detail · **activate/discard/withdraw/complete/graduate** |
| `school.enrollment.placement` | Placement history | as enrolment | `/enrollments/[id]` | ✅ read |
| `school.student.subject` | Derived subject enrolments | as enrolment | `/enrollments/[id]` | ✅ read |
| `school.student.guardian` | Guardians | Registrar, Admin, Director, Teacher | `/students/[id]` | ✅ read |
| `school.assessment` | Assessment state machine | Teacher, Exam Officer, Registrar, Director | `/assessments`, `/assessments/[id]` | ✅ list · detail · **open/regenerate/submit/return/reopen/approve/lock/publish** |
| `school.mark` | Mark entry | Teacher (own assignment), Exam Officer | `/assessments/[id]`, `/marks` | ✅ list · **inline score/status/remark entry** |
| `school.assessment.event` | Immutable audit trail | as assessment | `/assessments/[id]` | ✅ read |
| `school.attendance` | Attendance capture | Teacher, Registrar, Admin | `/attendance` | ✅ list · **roster generation** · **status entry** |
| `school.class.schedule` | Timetable | Teacher, Admin | `/schedule`, `/schedule/[id]` | ✅ list · detail · **publish/complete/cancel** |
| `school.announcement` | Announcements | Registrar, Front Office, Admin, Teacher | `/announcements`, `/announcements/[id]` | ✅ list · detail · **publish/archive/reset** |
| `school.program` | Programs | Registrar, Admin, Teacher | `/programs`, `/programs/[id]` | ✅ list · detail · **publish/complete/cancel** |
| `school.document` | Document register | Registrar, Admin, HR | `/documents`, `/documents/[id]` | ✅ list · detail · **verify/reject with reason** |
| `school.report.card` | Report cards | Exam Officer, Admin, Director, Registrar | `/report-cards`, `/report-cards/[id]` | ✅ list · detail · **generate/approve/publish** |
| `school.promotion.batch` | Promotion | Registrar, Admin, Teacher | `/promotion`, `/promotion/[id]` | ✅ list · detail · **calculate/approve/apply** |
| `school.grade` · `school.section` · `school.stream` · `school.shift` · `school.campus` · `school.room` · `school.term` · `school.grade.subject` | Academic configuration | Registrar, Admin | `/configuration` | ✅ read, per-card degradation |

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

## 6. Backend security: what was repaired, and what is still open

### Repaired

Four record rules could never fire because no ACL row existed for the group.
The intent was unambiguous from `README.md`'s access matrix, so the four
missing rows were added to `security/ir.model.access.csv` — the smallest
correct fix, since the rules themselves were already right:

| Rule | Group | Model | ACL added | Verified on staging |
|---|---|---|---|---|
| `rule_student_all_director` | Director | `school.student` | `1,0,0,0` | 6 rows |
| `rule_student_contact_frontoffice` | Front Office | `school.student` | `1,0,0,0` | 6 rows |
| `rule_mark_all_director` | Director | `school.mark` | `1,0,0,0` | 18 rows |
| `rule_mark_all_registrar` | Registrar | `school.mark` | `1,1,1,1` | 18 rows |

README basis: *"Director / Principal — **Read-only** on every academic model,
unscoped… No create, write, or delete anywhere"*; *"Registrar — Full
create/edit/delete on … marks"*; *"Delete is held by Registrar and School
Administrator"*; *"Front Office — All students for contact lookup."*

### Still open — needs a product decision, NOT fixed here

README says the Director is read-only on **every** academic model. In fact
`group_school_director` has no ACL row on:

`school.teacher` · `school.class` · `school.subject` · `school.academic.year` ·
`school.term` · `school.teacher.assignment`

Front Office likewise has none on any academic model. Those nav entries are
therefore hidden from those roles rather than offered as 403s. Widening them
is an authorisation policy change and is deliberately left to the owner.

Also unchanged: `school.grading.policy`, `school.report.card.line` and
`school.subject.result` have no ACL declarations at all (the repo's own
`scripts/check_acl_coverage.py` reports this on untouched `main` too).

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
node scripts/e2e-staff.mjs     http://localhost:3100   # staff write workflow
node scripts/e2e-student.mjs   http://localhost:3100   # student lifecycle + uploads
node scripts/e2e-session-expiry.mjs http://localhost:3100  # expired-session recovery
node scripts/route-sweep.mjs   http://localhost:3100   # every route, every role
```

Current results: **18 + 21 + 25 + 7 passing, and the sweep clean across
21 routes × 4 roles (84 combinations).**

`e2e-staff.mjs` creates one synthetic staff record on staging, activates it
through `action_activate`, asserts Odoo minted the `STF-` sequence and the
linked `hr.employee`, then deactivates it.

Both scripts need `E2E_PASSWORD`, `E2E_TEACHER_LOGIN`, `E2E_REGISTRAR_LOGIN`
in the environment — no credential is committed. They drive the system Chrome
through `playwright-core`, so no browser download is required.

They target **staging only**. Never point them at production.

`SESSION_COOKIE_SECURE=false` exists only so a local `next start` over plain
http can hold a session — `next start` forces NODE_ENV=production, which would
otherwise set a `Secure` cookie the browser declines to return on same-site
POSTs, breaking every server action. Never set it in a deployed environment.


---

## 8. How a business transition reaches Odoo

Every state change in the application takes one path:

```
Browser posts {workflow, transition, id, reason?}   ← never a model or method
        ▼
app/(app)/workflow-action.ts        resolves the allowlist entry, or refuses
        ▼
lib/odoo/workflows.ts               model + method + guard for that key
        ▼
callAction()                        as the signed-in user's Odoo session
        ▼
Odoo action_*                       ACL → record rule → guard → side effects
```

Odoo takes a reason in three different shapes, and the allowlist records which:
in the context (`transition_reason` on assessment transitions), as a positional
argument (`action_return(reason)`), or written to a field first
(`school.document.action_reject` raises unless `rejection_reason` is set).

The `from` states in the allowlist decide which buttons are *offered*. Odoo
re-checks the same guard, so a stale page produces a rejected action with its
own message — never a silent success.
