#!/usr/bin/env bash
# Start Odoo on Render.
#
# This exists to solve two problems that only appear on Render.
#
# 1. PORT means two different things.
#    Render injects PORT as the HTTP port. The official Odoo image's entrypoint
#    reads PORT as the *PostgreSQL* port:
#
#        : ${PORT:=${DB_PORT_5432_TCP_PORT:=5432}}
#        check_config "db_port" "$PORT" "PGPORT"
#
#    and appends its own --db_port last, where it beats anything passed before
#    it. Left alone, Odoo would try to reach Neon on Render's HTTP port. This
#    script is invoked as the container command, so the entrypoint takes its
#    `*) exec "$@"` branch and injects nothing at all. PostgreSQL is configured
#    from DB_PORT here, and PORT is used only for HTTP.
#
# 2. There is no config file on Render.
#    /etc/odoo/odoo.conf is a bind mount in local development, and it cannot be
#    committed because it holds credentials. It is written here from the
#    environment instead, and never leaves the container.
set -euo pipefail

fail() {
    echo "render-start: $*" >&2
    exit 1
}

for var in DB_HOST DB_NAME DB_USER DB_PASSWORD ODOO_ADMIN_PASSWD; do
    if [ -z "${!var:-}" ]; then
        fail "$var is not set. Add it to the Render service's environment."
    fi
done

# Neon's PostgreSQL port. Deliberately not $PORT — see the note above.
DB_PORT="${DB_PORT:-5432}"
# Render's HTTP port. 8069 keeps the script usable outside Render.
HTTP_PORT="${PORT:-8069}"

CONF="${ODOO_RC:-/etc/odoo/odoo.conf}"
umask 077
cat > "$CONF" <<CONF_EOF
[options]
addons_path = /mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons
data_dir = /var/lib/odoo

; Guards database create/drop/duplicate. Not the login password.
admin_passwd = ${ODOO_ADMIN_PASSWD}
; No database manager on a shared, internet-facing instance.
list_db = False

db_host = ${DB_HOST}
db_port = ${DB_PORT}
db_user = ${DB_USER}
db_password = ${DB_PASSWORD}
db_name = ${DB_NAME}
dbfilter = ^${DB_NAME}\$
; Neon terminates TLS and refuses plaintext.
db_sslmode = require

; Behind Render's proxy, so trust its forwarding headers.
proxy_mode = True
; One process: websockets stay in-thread and there is a single HTTP port to
; publish. A nine-person staging environment does not need a worker pool.
workers = 0
; Without this the module's four scheduled actions never run.
max_cron_threads = 1
CONF_EOF

# One-off database initialization.
#
# Render's free plan gives no shell, and initializing over the internet from a
# developer laptop is impractically slow: an Odoo install issues tens of
# thousands of small queries and each one pays the round trip, so a
# cross-continent install takes hours. This container runs in the same region
# as the database, where the same work takes minutes.
#
# Set ODOO_INIT=school_management in the Render dashboard, deploy once, then
# REMOVE the variable and deploy again. Left set, it re-runs the install on
# every boot.
INIT_ARGS=()
if [ -n "${ODOO_INIT:-}" ]; then
    echo "render-start: ODOO_INIT=${ODOO_INIT} — installing on this boot. Remove the variable once it succeeds."
    INIT_ARGS+=(-i "${ODOO_INIT}")
fi

echo "render-start: HTTP on 0.0.0.0:${HTTP_PORT}; PostgreSQL ${DB_HOST}:${DB_PORT}/${DB_NAME} (sslmode=require)"

exec odoo \
    --config="${CONF}" \
    --http-interface=0.0.0.0 \
    --http-port="${HTTP_PORT}" \
    "${INIT_ARGS[@]}"
