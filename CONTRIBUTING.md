# Contributing — Async School Management System

## Commit message format
Use conventional commits: `type(scope): short description`

Types: feat, fix, refactor, docs, test, chore
Scopes: student, class, attendance, mark, security, ci

Examples:
feat(student): add registration form validation
fix(attendance): prevent duplicate entries per session
refactor(mark): simplify grade calculation logic
docs(readme): add setup instructions

## Branching
One branch per workstream. Never commit directly to main.

Name branches after the work, not the person: `feature/mark-list`,
`fix/schedule-conflict`. A branch named after its author tells nobody whether it is
finished, which is how the repo once accumulated 26 stale branches.

## Pull requests
- Open a PR against main when your workstream is ready for integration
- At least 1 teammate must review and approve before merge
- CI must pass before merge — it installs the module **with demo data** and runs the
  full test suite, so a broken record rule or broken demo XML fails the build
- Squash-merge preferred, keep the PR title as a conventional commit

## Before opening a PR

```bash
docker compose exec odoo odoo -c /etc/odoo/odoo.conf -d "$ODOO_DB" \
  -u school_management --test-enable --test-tags /school_management \
  --no-http --stop-after-init
```

- Tests must be green. This is the same command CI runs.
- No credentials, `.env`, `config/odoo.conf`, or private attachments in the diff.

## The database is not in the repo

The repo holds code. Your database holds state, and the two drift apart silently.

- **Anything the team must see belongs in `data/` (real) or `demo/` (fictional) XML.**
  Records created through the UI exist only on your machine.
- **Never assign security groups through Settings → Users.** Group membership lives in
  a table nothing tracks. `security/school_security.xml` is the only place that grants
  a group, so a change there reaches everyone and a change in the UI reaches nobody.
- **Build the database with `./scripts/reset-db.sh`**, never through the web database
  manager — it is disabled (`list_db = False`) for exactly that reason.
- After pulling, run the upgrade above, then hard-refresh (`Ctrl+Shift+R`). Odoo caches
  menus in a compiled asset bundle; a stale bundle is the usual reason a teammate's new
  menu does not show up for you.

## Changing a model field

Renaming or removing a field breaks every `demo/` and `data/` XML record that
references it, and the module then fails to install for the whole team — not just for
the feature that changed it. Grep the XML before you rename, and let CI confirm.
