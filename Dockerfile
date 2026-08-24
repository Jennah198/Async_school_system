ARG ODOO_VERSION
FROM odoo:${ODOO_VERSION}
USER root
RUN pip install --break-system-packages ethiopian-date
USER odoo