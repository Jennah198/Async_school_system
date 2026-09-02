# Handout — Odoo 19 → Next.js frontend

Pick-up notes for continuing this work in a fresh session.

**Branch:** `feat/nextjs-odoo-frontend` (26 commits, pushed).
**`main` is untouched. Production is untouched.** Neither has ever been written to.

Read [`docs/NEXTJS_FRONTEND_ARCHITECTURE.md`](docs/NEXTJS_FRONTEND_ARCHITECTURE.md)
first — it is the design record. This file is the operational handover.

---

## 1. What this is

A Next.js 16 frontend replacing the Odoo web client for the existing
`school_management` module. Odoo stays the backend, business-logic engine and
**authorization system**. Next.js is the user-facing app and the only thing the
browser talks to.

```
Browser → Next.js (server) → Odoo 19 → Neon PostgreSQL
```

The browser never reaches Odoo. Odoo serves **no CORS headers** — verified on
both environments. **Do not add CORS**; if someone proposes it, that means the
browser is about to talk to Odoo directly, which this architecture forbids.

---

## 2. Environments

| | URL | Use |
|---|---|---|
| **Staging** | `https://async-school-staging.onrender.com` (db `neondb`) | **everything** |
| Production | `https://async-school-system.onrender.com` (db `school`) | **never touch** |

Production holds real school data. It has never been authenticated against in
this work and must not be. All development and testing targets staging only.

---

## 3. Getting running

```bash
cd nextjs
npm install
cp .env.example .env.local      # then fill it in — see below
npm run dev                     # or: npm run build && npm run start
```

`.env.local` (git-ignored, never commit):

```
ODOO_BASE_URL=https://async-school-staging.onrender.com
ODOO_DB=neondb
SESSION_SECRET=<openssl rand -base64 32>
ODOO_TIMEOUT_MS=60000
SESSION_COOKIE_SECURE=false      # ONLY for a local run over plain http
```

> `SESSION_COOKIE_SECURE=false` exists because `next start` forces
> `NODE_ENV=production`, which would set a `Secure` cookie that Chrome then
> declines to return on same-site POSTs over `http://localhost` — every server
> action then looks signed-out. **Never set it in a deployed environment.**

Staging can sleep (Render free plan); the first request may take ~1 minute.

### Test accounts

Synthetic staging users, all `@example.invalid`, created during this work:

```
srs.demo.language@example.invalid      Teacher   (Grade 3 only — narrow scope)
srs.demo.math@example.invalid          Teacher   (Grade 3 + Grade 11 Natural)
srs.demo.registrar@example.invalid     Registrar
srs.demo.director@example.invalid      Director
srs.demo.frontoffice@example.invalid   Front Office
```

They share one password, which is **deliberately not written here** — this repo
is public. Ask Tommy, or reset it from `odoo shell` against staging. If the
users are ever lost, `env['school.demo.seed'].seed_all()` recreates the SRS
demo data (5 staff, 3 teachers, 6 students, 2 classes, 6 subjects, 18 marks).

---

## 4. What is built

21 routes covering the whole domain. Everything below is **tested against
staging**, not just compiled.

| Domain | Routes | Read | Write / business actions |
|---|---|---|---|
| Auth | `/login`, `/signed-out` | — | sign in, sign out, expired-session recovery |
| Dashboard | `/dashboard` | role-aware tiles | — |
| Students | `/students`, `/students/new`, `/students/[id]` | list, search, paging, detail, guardians, enrolments | **register**, **upload birth certificate / previous-grade doc**, verify → submit → approve → reject |
| Enrolments | `/enrollments`, `/enrollments/[id]` | register, subjects, placement history | activate / discard / withdraw / complete / graduate |
| Staff | `/staff`, `/staff/new`, `/staff/[id]` | list, detail, responsibilities, employment, daily status | **register**, activate / suspend / deactivate / reset |
| Teachers | `/teachers` | list + Odoo-computed workload | — |
| Academics | `/academic-years`, `/classes`, `/subjects`, `/configuration` | lists; grades, sections, streams, shifts, campuses, rooms, terms, curriculum | — |
| Teaching | `/assignments`, `/schedule`, `/schedule/[id]`, `/attendance` | lists, slot detail | timetable publish/complete/cancel; **attendance roster generation + status entry** |
| Assessment | `/assessments`, `/assessments/[id]`, `/marks` | list, detail, audit trail | **inline mark entry**; open / regenerate / submit / return / reopen / approve / lock / publish |
| Records | `/report-cards`, `/report-cards/[id]`, `/promotion`, `/promotion/[id]`, `/documents`, `/documents/[id]` | lists, details, subject lines, outcomes | report card generate/approve/publish; promotion calculate/approve/apply; document verify/reject |
| Operations | `/announcements`, `/announcements/[id]`, `/programs`, `/programs/[id]` | lists, details | publish / archive / complete / cancel / reset |

---

## 5. Rules to keep

These are load-bearing. Breaking one breaks the security model.

1. **Authorization is Odoo's.** `lib/navigation.ts` hides doors and
   `hasAccess()` hides buttons — neither is a boundary. Every call is
   re-authorised by Odoo as the signed-in user. There is no service account,
   and no way to call Odoo as anyone else.
2. **Never let the browser name a model or a method.** Transitions go through
   the allowlist in `lib/odoo/workflows.ts` via `app/(app)/workflow-action.ts`.
3. **Explicit field lists, always.** A bare `search_read` raises `AccessError`
   for anyone below `base.group_system`, and pulls unstored computes that each
   run their own queries per row.
4. **Never work around a 403.** Fayda ID, date of birth, FAN, and the document
   binaries carry field-level groups. A refusal is the correct answer.
5. **Business logic stays in Odoo.** State changes call the model's `action_*`
   method, never `write({state})` — the transitions mint sequences, create
   related records and write audit events a field write would skip. Grades and
   percentages are displayed as Odoo computes them.
6. **No traceback ever reaches a browser.** `lib/odoo/errors.ts` maps
   exceptions to `{code, message}` and drops Odoo's `debug` field.
7. **Any `catch` around an Odoo call must call `unstable_rethrow` first.**
   `redirect()` works by throwing; a bare `catch {}` swallows it and strands
   the user. Use `orNullOnRefusal()` from `lib/odoo/errors.ts`.

---

## 6. Testing

```bash
cd nextjs
npm run lint && npm run build && npx tsc --noEmit
npm run start                                  # then, against the running app:

export E2E_PASSWORD=... E2E_TEACHER_LOGIN=... E2E_REGISTRAR_LOGIN=... \
       E2E_DIRECTOR_LOGIN=... E2E_FRONTOFFICE_LOGIN=...

node scripts/e2e-staging.mjs        http://localhost:3100   # 18 — authorization edges
node scripts/e2e-staff.mjs          http://localhost:3100   # 21 — staff + repaired ACLs
node scripts/e2e-student.mjs        http://localhost:3100   # 25 — student lifecycle
node scripts/e2e-session-expiry.mjs http://localhost:3100   #  7 — expired-session recovery
node scripts/route-sweep.mjs        http://localhost:3100   # 21 routes × 4 roles
```

All green as of the last commit. The suites drive the system Chrome through
`playwright-core` — no browser download. They create clearly-named synthetic
records (`PhaseF …`) on staging; the staff probe self-cleans, the student probe
cannot (Odoo forbids deleting a student with academic history).

---

## 7. Backend change made here

One Odoo change, in `addons/school_management/security/ir.model.access.csv`:
**four missing ACL rows**, because four record rules could never fire without
them. The intent was unambiguous from `README.md`'s access matrix.

| Rule | Group | Model | Added |
|---|---|---|---|
| `rule_student_all_director` | Director | `school.student` | `1,0,0,0` |
| `rule_student_contact_frontoffice` | Front Office | `school.student` | `1,0,0,0` |
| `rule_mark_all_director` | Director | `school.mark` | `1,0,0,0` |
| `rule_mark_all_registrar` | Registrar | `school.mark` | `1,1,1,1` |

Already applied to staging (`-u school_management`). **It is not on `main`** —
it ships when the PR merges, and production needs a module upgrade at that
point.

---

## 8. Open decisions — needed before more UI

**1. Director and Front Office ACL coverage.** `README.md` says the Director is
read-only on *every* academic model. In fact `group_school_director` has **no
ACL row** on `school.teacher`, `school.class`, `school.subject`,
`school.academic.year`, `school.term`, `school.teacher.assignment`,
`school.class.schedule`, `school.attendance`, `school.announcement` or
`school.program`. Front Office has none on any academic model.

Current menus, matching the real ACLs:

```
teacher      16 items      registrar   18 items
director      7 items      frontoffice  4 items
```

Is README authoritative, or the CSV? It's a small change either way, but it is
authorization policy, not frontend work.

**2. Student and parent portals.** `group_school_student_portal` and
`group_school_guardian_portal` hold **zero ACL rows**. No portal can be built
until that is designed — and guardian scoping (one parent, only their own
children) is the highest-consequence rule in the system.

**3. Staging hygiene.** The default Odoo admin login still works on the public
staging URL, and the Render `ODOO_ADMIN_PASSWD` is a weak default. Both were
shared in chat during this work, so treat them as compromised and rotate them.

---

## 9. Known gotchas

- **The module on `main` moves.** Field names have changed under us three
  times: `fan_number` (not `national_id`), `occupation` (not `email`) on
  `school.student.guardian`, and `emergency_contact_*` becoming required.
  **Read the model before writing a service.** One pass over
  `addons/school_management/models/*.py` costs one command and saves a rebuild.
- `school.report.card` and `school.grading.band` are each defined in **two**
  module files; Odoo merges them. Read defensively.
- `has_access` is a record method, not `@api.model` — `call_kw` needs
  `[[], operation]`, not `[operation]`.
- `missing_to_activate` and `employee_id` on `school.staff` cannot be read by a
  teacher (one computes from `date_of_birth`, the other resolves an
  `hr.employee`). They are fetched separately and degrade to null.
- Odoo takes a transition reason three different ways — context key, positional
  argument, or field-write-then-call. The allowlist records which per
  transition.
- Next.js 16: `cookies()` is **async**; Middleware is renamed **Proxy**; read
  `nextjs/node_modules/next/dist/docs/` rather than trusting memory.
- Windows: `docker exec` needs `MSYS_NO_PATHCONV=1`, and killing the dev server
  needs `netstat -ano | grep :3100` + `taskkill //F //PID`. A stale server on
  3100 silently serves an old build.

---

## 10. Suggested next steps

1. **Answer §8.1** — then widen `lib/navigation.ts` and the Director/Front
   Office screens in one pass.
2. **Open the PR** for `feat/nextjs-odoo-frontend` and get the ACL fix reviewed.
3. **Role dashboards.** `/dashboard` is currently one shared page with
   role-aware tiles; the brief asks for role-shaped experiences.
4. **Remaining write paths**: create/edit for classes, subjects, terms,
   assignments and curriculum (`school.class.subject.wizard.action_apply`
   already exists and handles reactivation correctly).
5. **Deployment.** Nothing is deployed yet. Target is Vercel → Render, with
   Odoo moved to a **private** network and an always-on plan (the free tier
   sleeps, and `workers = 0` means single-threaded).

---

## 11. Things deliberately not done

- No production access, ever.
- No CORS added.
- No Odoo business logic reimplemented in TypeScript.
- The four dead record rules were fixed; the *wider* Director/Front Office gap
  was left alone — it needs a decision, not a guess.
- `odoo_backup_before_migration.dump` (committed to public `main`) was left in
  place at Tommy's direction, and nothing in the Next.js app reads it.
