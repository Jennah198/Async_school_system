from psycopg2 import sql

# Every table carrying academic_year: school.class holds it, the other three store a
# related copy. A raw UPDATE on school.class alone would leave those copies stale,
# because a stored related field only recomputes when the ORM sees the source change.
TABLES = (
    'school_class',
    'school_class_schedule',
    'school_mark',
    'school_teacher_assignment',
)

LEGACY_FORMAT = '^[0-9]{4}-[0-9]{4}$'


def migrate(cr, version):
    """Academic year moved from a free-text Char to a Selection of 'YYYY/YYYY'.

    Rows written before the change hold 'YYYY-YYYY'. Postgres stores both a Char and
    a Selection as varchar, so the upgrade succeeds silently and leaves those values
    in place — but they are not valid Selection entries, so the field renders blank
    and, being required, forces whoever next edits the record to re-pick a year and
    quietly rewrite history.
    """
    if not version:
        return

    for table in TABLES:
        cr.execute("SELECT to_regclass(%s)", (table,))
        if not cr.fetchone()[0]:
            continue
        cr.execute(
            sql.SQL(
                'UPDATE {} SET academic_year = replace(academic_year, %s, %s) '
                'WHERE academic_year ~ %s'
            ).format(sql.Identifier(table)),
            ('-', '/', LEGACY_FORMAT),
        )
