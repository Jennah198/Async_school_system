# Async School Management System

An Odoo 17 add-on covering student registration, staff and teacher registration,
assignments, program and class scheduling, targeted announcements, attendance,
and marks.

## Setup

1. Clone this repo
2. `cp .env.example .env`
3. `docker compose up -d`
4. Visit http://localhost:8070, create a database
5. Install the **School Management** module from Apps

Port 8070 on the host maps to Odoo's 8069 in the container (see `docker-compose.yml`).

### Install or upgrade from the command line

```bash
# fresh install with fictional demo data
docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d <db> -i school_management \
  --no-http --stop-after-init

# fresh install without demo data
docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d <db> --without-demo=all \
  -i school_management --no-http --stop-after-init

# upgrade an existing database after pulling changes
docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d <db> -u school_management \
  --no-http --stop-after-init

# run the module's tests
docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d <db> -u school_management \
  --test-enable --test-tags /school_management --no-http --stop-after-init
```

`--no-http` matters when the stack is already running: without it the CLI process
tries to bind port 8069 and logs a traceback before continuing.

Restart the server container after changing Python files so the registry reloads:
`docker compose restart odoo`.

## Demo logins

Installed only when the database is created **with** demo data. Password is `demo`
for all of them.

| Login | Role |
|---|---|
| `demo_registrar` | HR / Registrar |
| `demo_director` | Academic Director |
| `demo_teacher_maths` | Teacher — Mathematics and Amharic, Grade 1 A |
| `demo_teacher_science` | Teacher — General Science, Grade 2 A |
| `demo_teacher_amharic` | Teacher — Amharic, Grade 1 A, East Campus |
| `demo_librarian` | Staff, Librarian responsibility, East Campus, no teaching assignments |

`demo_teacher_maths` and `demo_teacher_science` are the pair to use when showing
role isolation: each sees only their own classes, marks, and announcements.

## Roles and permission matrix

Groups form an implication ladder, so School Administrator holds every narrower role.

```
Read-Only User → Staff → Teacher → Department Head → Academic Director ┐
                     └→ HR / Registrar ─────────────────────────────────┴→ School Administrator
```

| Role | Access |
|---|---|
| Read-Only User | Published class schedules, classes, subjects, teachers, rooms, job titles. No edit actions. |
| Staff | Own staff record, programs and announcements targeted at them, programs they organise, announcements they author |
| Teacher | Everything above, plus students, attendance, and marks for **assigned classes and subjects only**, own class schedule at any status |
| Department Head | Teacher rights plus the Analysis dashboards |
| Academic Director | All academic data: subjects, classes, assignments, schedules, programs, announcements, attendance, marks |
| HR / Registrar | Student and staff master data including **private documents**, job titles, staff responsibilities |
| School Administrator | Everything, plus rooms |

Attendance and marks are create/write for Teacher but **unlink is Academic Director
only**, so a teacher cannot delete history.

### Private documents

Staff and teacher document binaries carry a field-level group of
`group_school_registrar`. Anyone below that role cannot read them through the form
view *or* the ORM — `read(['id_document'])` raises `AccessError`. The Documents tab
does not render at all for other roles.

## Status transitions

**Class schedule** — `Draft → Published → Completed`, with `Cancelled` and
`Rescheduled`. A cancelled slot releases its teacher, class, and room; every other
status still holds them. Moving to `Rescheduled` requires a reason, and the previous
day, date, and times stay in the chatter through field tracking.

**Program** — `Draft → Published → Completed`, with `Cancelled`. Cancelled programs
stay visible with their status rather than disappearing.

**Announcement** — `Draft → Published → Archived`. Only records that are published,
past their publish time, and not past their expiry are visible to their audience.

## Conflict and access-control test evidence

```bash
docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d <db> -u school_management \
  --test-enable --test-tags /school_management --no-http --stop-after-init
# school_management: 25 tests, 0 failed, 0 error(s) of 21 tests
```

`addons/school_management/tests/test_class_schedule.py` — teacher, class, and room
double-booking blocked; back-to-back slots allowed; same weekday in another term
allowed; a cancelled slot frees the room; a teacher with no assignment rejected;
weekday-or-date required; inactive teacher cannot be published; rescheduling
requires a reason; program audience requires values.

`addons/school_management/tests/test_security.py` — a teacher sees attendance,
marks, and students only for assigned classes and subjects; announcements targeted
at another class or another subject are invisible; draft and expired announcements
are invisible; staff documents raise `AccessError` below Registrar; a plain staff
user sees no other staff records; a teacher sees their own draft schedule but not
another teacher's.

## Regression checklist

Run before merging anything into `main`. Each row is a previously accepted workflow.

| # | Workflow | Steps | Expected |
|---|---|---|---|
| 1 | Student registration is the master source | Students → New → fill name, DOB, guardian, phone, class, birth certificate → set Approved | Saves; `regno` is generated; missing documents block Approved with a named list |
| 2 | Guardian phone validation | Save a student with `0911` and no nationality | Blocked with the phone-format message |
| 3 | Entry-level exemption | Approve a student in a class flagged Entry Level with no previous-grade document | Allowed |
| 4 | Attendance loads approved students | Academic → Attendance → New → pick a student | Class auto-fills from the student; one row per student per date enforced |
| 5 | Mark list loads approved students | Academic → Mark List → New | Only Approved students selectable; percentage and grade compute; duplicate student/subject/term/assessment blocked |
| 6 | Mark needs a teaching assignment | Enter a mark for a subject nobody is assigned to teach in that class | Blocked with a named message |
| 7 | Unique student ID | Attempt two students with the same `regno` | Blocked |
| 8 | Staff registration | Administration → Staff → New with department and job title | `staff_id` generated; job title limited to the chosen department |
| 9 | Staff document privacy | Open a staff record as `demo_teacher_maths` | Documents tab absent |
| 10 | Teacher links to staff | Academic → Teachers → New | Staff Record required; one teacher profile per staff member |
| 11 | Teacher workload | Add assignments beyond the teacher's maximum weekly periods | Blocked with the workload message |
| 12 | Job titles reachable when archived | Administration → Job Titles → filter Archived | Archived titles listed |
| 13 | Class schedule conflicts | Book two overlapping slots on one teacher, class, or room | Blocked with a message naming the clashing slot |
| 14 | Schedule needs an assignment | Schedule a teacher for a subject they are not assigned | Blocked |
| 15 | Role isolation | Log in as `demo_teacher_maths`, then `demo_teacher_science` | Each sees only their own classes, marks, attendance, and announcements |
| 16 | Announcement audience | Open My Announcements as each demo teacher | Grade 1 A notice only for the maths teacher; laboratory notice only for the science teacher; assembly notice for both |
| 17 | Owner data isolation | Log in as `demo_librarian` | No students, no marks, no other staff records |
| 18 | Responsibility targeting | Open My Announcements as `demo_registrar` | Sees the Registrar notice; teachers do not |
| 19 | Campus targeting | Open My Announcements as `demo_librarian` (East) vs `demo_teacher_maths` (Main) | East Campus water notice only for East staff |
| 20 | Staff control status | Suspend a staff member, then add a teaching assignment | Blocked with the suspended-staff message |
| 21 | Master-record rename | Rename a staff record | Teacher name, assignments, and schedules follow |
| 22 | Draft gate | Activate a staff record with no responsibility | Blocked, listing what is missing |
| 23 | One homeroom per class | Assign a second homeroom teacher to the same class and term | Blocked |
| 24 | Admin overview | School → Overview as admin | Real counts; each tile opens its records |

## Known issues and incomplete work

Stated honestly — these are **not** finished.

- **Section, Academic Year, and Term are not their own records.** Section is a `Char`
  on `school.class`, academic year a `Char`, term a two-value `Selection`. The brief
  asks for relational fields to them. Everything keys off the class record instead, so
  the links are consistent, but there is no Academic Year or Term master table.

- **`staff_id` is not NOT NULL on upgraded databases.** Making it required on a table
  that already held teacher rows fails the migration; Odoo logs
  `unable to set NOT NULL on column 'staff_id'` and leaves the column nullable. Fresh
  installs get the constraint. Needs a pre-init migration that backfills existing rows.
- **Dated and recurring schedule slots do not cross-check.** A one-off makeup class on
  a date that lands on a recurring weekday is not flagged as a conflict. Recurring
  slots only collide with recurring slots in the same term.
- **The class-schedule calendar shows dated sessions only.** Recurring slots have no
  date. Positioning hours on a calendar needs timezone-aware datetimes that render
  wrong for users in other zones, so Weekly Timetable covers the recurring case as a
  list grouped by day.
- **Reporting is native graph and pivot views**, not per-role dashboard pages. They
  read real records and are scoped by the same record rules, so a teacher and a
  director see different totals from the same menu.
- **No attendance or mark approval workflow.** Both are direct entry with no
  submit-and-review step.

## Structure

```
addons/school_management/
├── models/          # one file per domain concept
├── views/           # one file per model, plus menus and dashboards
├── security/        # role groups, record rules, and ACLs
├── data/            # sequences and seed job titles
├── demo/            # fictional demonstration data
├── report/          # student report
└── tests/           # conflict and access-control tests
```
