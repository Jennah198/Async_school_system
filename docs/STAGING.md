# Shared staging environment

One shared Odoo instance the whole team tests against, so nobody has to reason
about whose local database is in what state.

```
GitHub main ──► Render (Docker, free) ──► Odoo 19 ──► Neon PostgreSQL (free)
```

**Staging is not production.** It holds synthetic data only, it is allowed to
sleep, and it can be rebuilt from scratch at any time.

---

## What you need before you start

| Thing | Where | Notes |
|---|---|---|
| Neon account | neon.tech | Free plan |
| Render account | render.com | Free plan, connected to the GitHub repo |
| A Docker install | your machine | Only for the one-off initialization |

---

## 1. Create the Neon database

1. Create a Neon project. Pick **PostgreSQL 16** and a region close to the team.
2. Create a database named **`school`**.
3. Open **Connection Details** and copy the **direct** connection string —
   the host **without** `-pooler` in it.

> **Use the direct/unpooled host.** Odoo keeps session-level state and the demo
> seeder takes a `pg_advisory_xact_lock`; a transaction pooler breaks both. The
> pooled endpoint will appear to work and then fail in confusing ways.

You need four values from that string:

```
DB_HOST      ep-xxxx-xxxx.eu-central-1.aws.neon.tech     (no -pooler)
DB_PORT      5432
DB_USER      neondb_owner
DB_PASSWORD  ...
```

## 2. Initialize the database (one-off, from your machine)

Render's free plan gives no shell, so the first-time setup runs locally against
Neon — Neon is reachable from anywhere.

```bash
export NEON_HOST=...        # direct host, no -pooler
export NEON_USER=...
export NEON_PASSWORD=...

# Install the module with demo data. Demo records are fictional, which is
# exactly what staging should contain.
docker compose run --rm --no-deps \
  -e HOST="$NEON_HOST" -e PORT=5432 -e USER="$NEON_USER" -e PASSWORD="$NEON_PASSWORD" \
  odoo odoo -d school -i school_management \
  --db_sslmode=require --no-http --stop-after-init
```

Expect `Modules loaded.` and exit code 0. This takes a few minutes.

## 3. Switch staging to database-backed attachments

**Do this before anyone uploads anything.**

Render's filesystem is ephemeral: it is wiped on every redeploy, restart and
wake-from-sleep. Odoo stores attachment payloads on disk by default
(`ir_attachment.location = file`), so on Render every uploaded document,
photo and birth certificate would be destroyed on the next deploy — the
database would keep the record and lose the bytes.

Setting the location to `db` puts the payloads in PostgreSQL, which persists.

```bash
docker compose run --rm --no-deps -T \
  -e HOST="$NEON_HOST" -e PORT=5432 -e USER="$NEON_USER" -e PASSWORD="$NEON_PASSWORD" \
  odoo odoo shell -d school --db_sslmode=require --no-http <<'EOF'
env['ir.config_parameter'].sudo().set_param('ir_attachment.location', 'db')
env.cr.commit()
# Odoo's own supported migration for anything written during the install above.
env['ir.attachment'].sudo().force_storage()
env.cr.commit()
env.cr.execute("SELECT count(*) FILTER (WHERE store_fname IS NOT NULL) FROM ir_attachment")
print('attachments still on disk (must be 0):', env.cr.fetchone()[0])
EOF
```

It must print `0`.

> This is a **staging-only** setting. It lives in the staging database, not in
> the repository, so local development and any future production deployment are
> untouched and keep using the filestore.

## 4. Create the Render service

1. **New → Blueprint**, point it at this repository. Render reads `render.yaml`.
2. Set the four secret environment variables in the dashboard:
   `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `ODOO_ADMIN_PASSWD`.
   (`DB_PORT=5432` and `DB_NAME=school` are already in the blueprint.)
   `ODOO_ADMIN_PASSWD` is Odoo's **master password**, which guards database
   create/drop/duplicate — not the login password. Make it a long random string.
3. Deploy. The first build takes several minutes.

Render's health check hits `/web/health`, which returns `200 {"status":"pass"}`.

## 5. Secure the instance

Immediately after the first successful deploy:

1. Log in as `admin` / `admin`.
2. **Change the admin password.** The instance is on a public URL.
3. Create a user per teammate with a real role (Registrar, Teacher, HR) rather
   than everyone sharing `admin` — role-scoped bugs only appear when people use
   role-scoped accounts.

## 6. Verify

| Check | Expected |
|---|---|
| `curl https://<service>.onrender.com/web/health` | `200 {"status": "pass"}` |
| Log in | Odoo loads |
| Register a staff member with a 16-digit Fayda ID | Saves |
| Enter a 15-digit Fayda ID | Rejected with a clear message |
| Register a teacher on that staff record | Teacher form shows the same Fayda ID, read-only |
| Upload a document | Saves |
| Redeploy, then reopen the document | **Still there** — this is what step 3 buys |
| Run the synthetic staff import (below) | 20 draft staff created |

Optional synthetic dataset (20 fictional staff, no Fayda IDs):

```bash
docker compose run --rm --no-deps -T \
  -e HOST="$NEON_HOST" -e PORT=5432 -e USER="$NEON_USER" -e PASSWORD="$NEON_PASSWORD" \
  odoo odoo shell -d school --db_sslmode=require --no-http <<'EOF'
print(env['school.staff.import'].dry_run())
print(env['school.staff.import'].run_import())
env.cr.commit()
EOF
```

These 20 land in **Draft** and stay there: the dataset carries no birth date,
phone, job title or responsibility, and the import does not invent them.

## 7. Day-to-day deployments

```
feature branch → local tests → PR → CI → merge to main → Render deploys → team tests
```

Render redeploys automatically on every push to `main`. Only `main` deploys;
feature branches never do.

**A deploy updates the module. It never rebuilds the database.** If a merged
change needs a module upgrade (new field, new migration), run it once against
Neon from your machine:

```bash
docker compose run --rm --no-deps \
  -e HOST="$NEON_HOST" -e PORT=5432 -e USER="$NEON_USER" -e PASSWORD="$NEON_PASSWORD" \
  odoo odoo -d school -u school_management \
  --db_sslmode=require --no-http --stop-after-init
```

**Rollback:** in Render, open the service → **Deploys** → pick the previous
successful deploy → **Redeploy**. That rolls back the code. It does not roll
back the database, so a deploy that ran a migration needs a database restore
(Neon → **Restore** → point-in-time) as well.

## ⚠️ Never run `scripts/reset-db.sh` against staging

`reset-db.sh` **drops and recreates the database**. It is for local development
only, and it is hard-wired to the local `db` container, so it cannot reach Neon
by accident — but do not adapt it to. Destroying the shared database throws away
everyone's test data with no warning.

To deliberately rebuild staging: drop the database in the Neon console, create
it again, and repeat steps 2 and 3.

## Known limitations — all deliberate

**The service sleeps.** Render's free plan spins a service down after ~15
minutes without traffic. The first request afterwards takes roughly a minute
while the container starts and Odoo loads its registry. Waking it up is just
opening the URL and waiting.

**Scheduled jobs only run while the service is awake.** The module has four:
three daily, and one every five minutes (announcement visibility). While the
service sleeps, none of them run; they resume on wake. For testing this is
fine, and we are deliberately **not** working around it — no ping loops, no
keep-alive cron, no fake traffic.

**The filesystem is ephemeral.** Handled by step 3. If someone ever resets
`ir_attachment.location` back to `file`, uploads start disappearing on redeploy.

**The database is shared.** Anyone can change anyone's test data. Treat staging
as disposable and do not use it to store anything you would be sad to lose.

**Free-tier storage.** Neon's free plan gives 0.5 GB per project. The database
is roughly 47 MB, plus attachments now living inside it. There is plenty of
room, but a bulk upload of large documents would eat it.

**Email is not configured.** Creating a teacher *without* typing a password
calls `user.action_reset_password()`, which sends mail — that will fail until
SMTP is set. To test that path, add outgoing mail server settings in Odoo
(Settings → Technical → Outgoing Mail Servers) using a free relay. Everything
else, including creating a teacher *with* a password, works without SMTP.

## Data policy

Staging is public and shared. **Synthetic data only.**

Never enter a real Fayda ID, a real staff or student record, a real birth
certificate, or any real personal document. The demo data and the 20-row
dataset are both fictional, which is why they are the ones used here.
