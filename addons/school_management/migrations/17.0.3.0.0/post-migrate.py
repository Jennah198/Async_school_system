from psycopg2 import sql

# Selection keys as they were stored, mapped to the seeded records' XML ids.
TERM_XMLIDS = {'term1': 'term_1', 'term2': 'term_2'}
TERM_TABLES = ('school_class_schedule', 'school_mark', 'school_teacher_assignment')


def _column_exists(cr, table, column):
    cr.execute(
        'SELECT 1 FROM information_schema.columns '
        'WHERE table_name = %s AND column_name = %s',
        (table, column),
    )
    return bool(cr.fetchone())


def _xmlid_to_res_id(cr, name):
    cr.execute(
        "SELECT res_id FROM ir_model_data WHERE module = 'school_management' AND name = %s",
        (name,),
    )
    row = cr.fetchone()
    return row[0] if row else None


def migrate(cr, version):
    """Term moved from a Selection and section from a Char to school.term and
    school.section rows.

    Post- rather than pre-migrate: the new tables and the *_id columns do not exist
    until Odoo has created the new fields, and the seeded terms and sections load
    with the data files, which is also after pre-migrate. The legacy columns are
    left in place rather than dropped, so nothing is destroyed if this needs redoing.
    """
    if not version:
        return

    # --- terms -----------------------------------------------------------------
    term_ids = {key: _xmlid_to_res_id(cr, xmlid) for key, xmlid in TERM_XMLIDS.items()}
    for table in TERM_TABLES:
        if not _column_exists(cr, table, 'term'):
            continue
        for key, res_id in term_ids.items():
            if not res_id:
                continue
            cr.execute(
                sql.SQL('UPDATE {} SET term_id = %s WHERE term = %s AND term_id IS NULL')
                   .format(sql.Identifier(table)),
                (res_id, key),
            )

    # --- sections --------------------------------------------------------------
    # Section was free text, so anything could be in there. Create a record for each
    # distinct value rather than assuming it matches a seeded A/B/C/D.
    if _column_exists(cr, 'school_class', 'section'):
        cr.execute("""
            INSERT INTO school_section (name, sequence, active, create_uid, write_uid,
                                        create_date, write_date)
            SELECT DISTINCT btrim(c.section), 50, TRUE, 1, 1, now(), now()
              FROM school_class c
             WHERE c.section IS NOT NULL
               AND btrim(c.section) <> ''
               AND NOT EXISTS (
                   SELECT 1 FROM school_section s WHERE s.name = btrim(c.section)
               )
        """)
        cr.execute("""
            UPDATE school_class c
               SET section_id = s.id
              FROM school_section s
             WHERE s.name = btrim(c.section)
               AND c.section_id IS NULL
        """)

    # Odoo cannot put NOT NULL on a required field of a table that already holds
    # rows; it logs 'unable to set NOT NULL' and carries on, leaving upgraded
    # databases weaker than fresh ones. Apply it now that every row is mapped.
    for table in TERM_TABLES:
        cr.execute(
            sql.SQL('SELECT 1 FROM {} WHERE term_id IS NULL LIMIT 1').format(sql.Identifier(table))
        )
        if not cr.fetchone():
            cr.execute(
                sql.SQL('ALTER TABLE {} ALTER COLUMN term_id SET NOT NULL')
                   .format(sql.Identifier(table))
            )
