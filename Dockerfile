# Default so a build without --build-arg still targets the right series; the
# local compose stack passes it explicitly from .env.
ARG ODOO_VERSION=19
FROM odoo:${ODOO_VERSION}

USER root
RUN pip install --break-system-packages ethiopian-date

# Render builds this image with no bind mounts, so the module has to live in the
# image itself. Local development still mounts ./addons over this path, which
# shadows the copy, so `docker compose up` behaves exactly as before.
COPY --chown=odoo:odoo addons/ /mnt/extra-addons/

# The Render start script writes the generated config here, and /etc/odoo is
# root-owned in the base image while Odoo runs as the unprivileged odoo user.
COPY --chown=odoo:odoo scripts/render-start.sh /usr/local/bin/render-start.sh
RUN chmod +x /usr/local/bin/render-start.sh && chown odoo:odoo /etc/odoo

USER odoo
