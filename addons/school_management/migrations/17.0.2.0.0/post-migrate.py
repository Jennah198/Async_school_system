from psycopg2 import sql

# school.class owns the link; the other three carry a stored related copy. A stored
# related field only recomputes when the ORM sees the source change, and this migration
# moves data with SQL, so each table is mapped explicitly.
RELATED_TABLES = ('school_class_schedule', 'school_mark', 'school_teacher_assignment')


def _column_exists(cr, table, column):
    cr.execute(
        'SELECT 1 FROM information_schema.columns '
        'WHERE table_name = %s AND column_name = %s',
        (table, column),
    )
    return bool(cr.fetchone())


def migrate(cr, version):
    """Academic year moved from a string on each record to school.academic.year rows.

    Runs post- rather than pre-migrate because school_academic_year and the
    academic_year_id columns do not exist until Odoo has created the new fields.
    The legacy varchar columns are left in place rather than dropped, so this stays
    recoverable and nothing is destroyed if the mapping needs revisiting.
    """
    if not version:
        return
    if not _column_exists(cr, 'school_class', 'academic_year'):
        return

    # Seed data has already loaded by post-migrate, so only add years it did not cover.
    cr.execute("""
        INSERT INTO school_academic_year (name, active, create_uid, write_uid,
                                          create_date, write_date)
        SELECT DISTINCT c.academic_year, TRUE, 1, 1, now(), now()
          FROM school_class c
         WHERE c.academic_year IS NOT NULL
           AND c.academic_year <> ''
           AND NOT EXISTS (
               SELECT 1 FROM school_academic_year y WHERE y.name = c.academic_year
           )
    """)

    cr.execute("""
        UPDATE school_class c
           SET academic_year_id = y.id
          FROM school_academic_year y
         WHERE y.name = c.academic_year
           AND c.academic_year_id IS NULL
    """)

    for table in RELATED_TABLES:
        if not _column_exists(cr, table, 'academic_year'):
            continue
        cr.execute(
            sql.SQL("""
                UPDATE {} t
                   SET academic_year_id = y.id
                  FROM school_academic_year y
                 WHERE y.name = t.academic_year
                   AND t.academic_year_id IS NULL
            """).format(sql.Identifier(table))
        )

    # Rows whose legacy value was blank have nothing to map to. Park them on the
    # current year so the column can carry NOT NULL, as it does on a fresh install.
    cr.execute("""
        UPDATE school_class
           SET academic_year_id = (
               SELECT id FROM school_academic_year
                ORDER BY is_current DESC, name DESC LIMIT 1
           )
         WHERE academic_year_id IS NULL
    """)

    # Odoo cannot apply a required field's NOT NULL to a table that already held rows:
    # it logs 'unable to set NOT NULL' during _auto_init and moves on, leaving upgraded
    # databases weaker than fresh ones. Now that every row has a value, apply it.
    cr.execute('SELECT 1 FROM school_class WHERE academic_year_id IS NULL LIMIT 1')
    if not cr.fetchone():
        cr.execute('ALTER TABLE school_class ALTER COLUMN academic_year_id SET NOT NULL')
