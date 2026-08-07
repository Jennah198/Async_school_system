#!/usr/bin/env bash
# Rebuild the development database from scratch, deterministically.
#
# The repo holds code; the database holds state. Creating it by hand through the
# web manager makes every developer's copy differ — most of all the "load demo
# data" checkbox. This script is the only supported way to create it, so everyone
# who runs it lands on the same database.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "No .env — run: cp .env.example .env" >&2; exit 1; }
set -a; . ./.env; set +a

: "${ODOO_DB:?ODOO_DB must be set in .env}"
: "${POSTGRES_USER:?POSTGRES_USER must be set in .env}"

DEMO_FLAG=()
[ "${ODOO_LOAD_DEMO:-1}" = "0" ] && DEMO_FLAG=(--without-demo=all)

echo "Rebuilding '$ODOO_DB' (demo data: ${ODOO_LOAD_DEMO:-1})"
docker compose up -d db
docker compose exec -T db dropdb   -U "$POSTGRES_USER" --if-exists "$ODOO_DB"
docker compose exec -T db createdb -U "$POSTGRES_USER" "$ODOO_DB"

# --no-http keeps this from fighting the running server for port 8069.
docker compose run --rm odoo odoo -c /etc/odoo/odoo.conf -d "$ODOO_DB" \
  -i school_management "${DEMO_FLAG[@]}" --no-http --stop-after-init

docker compose up -d
echo "Done. http://localhost:8070 — login admin / admin"
