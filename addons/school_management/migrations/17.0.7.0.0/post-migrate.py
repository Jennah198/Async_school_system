def migrate(cr, version):
    """Anchor existing attendance rows to enrollments.

    Match on (student, class), preferring the active enrollment, then the
    newest. Rows whose student never got an enrollment stay NULL and keep
    working read-only; the NOT NULL constraint is applied only when every
    row is matched, mirroring the 17.0.3.0.0 pattern.
    """
    if not version:
        return

    cr.execute("""
        UPDATE school_attendance a
           SET enrollment_id = e.id
          FROM (
            SELECT DISTINCT ON (student_id, class_id) id, student_id, class_id
              FROM school_enrollment
             ORDER BY student_id, class_id, (state = 'active') DESC, id DESC
          ) e
         WHERE a.enrollment_id IS NULL
           AND e.student_id = a.student_id
           AND (a.class_id IS NULL OR e.class_id = a.class_id)
    """)
    matched = cr.rowcount

    cr.execute("SELECT count(*) FROM school_attendance WHERE enrollment_id IS NULL")
    unmatched = cr.fetchone()[0]
    if not unmatched:
        cr.execute("ALTER TABLE school_attendance ALTER COLUMN enrollment_id SET NOT NULL")

    cr.execute("""
        INSERT INTO ir_logging (name, type, level, dbname, message, path, func, line,
                                create_uid, write_uid, create_date, write_date)
        VALUES ('school_management', 'server', 'INFO', %s, %s,
                'migrations/17.0.7.0.0/post-migrate.py', 'migrate', '0',
                1, 1, now(), now())
    """, (cr.dbname,
          'Attendance re-anchor: %s rows matched to enrollments, %s unmatched.'
          % (matched, unmatched)))
