from odoo import SUPERUSER_ID, api

TYPE_LABELS = {
    'quiz': 'Quiz',
    'assignment': 'Assignment',
    'test': 'Test',
    'midterm': 'Mid-term Exam',
    'final': 'Final Exam',
}


def migrate(cr, version):
    """Wrap existing marks in assessments (SRS §9).

    One Approved assessment per distinct (class, subject, term, type) group —
    the plan migrates historical marks as already-reviewed results. Marks with
    no class stay unmatched and keep working read-only; NOT NULL is applied
    only when every row is matched, mirroring the attendance migration.
    """
    if not version:
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    cr.execute("""
        SELECT class_id, subject_id, term_id, exam_type,
               max(max_score), min(create_date)::date
          FROM school_mark
         WHERE assessment_id IS NULL AND class_id IS NOT NULL
      GROUP BY class_id, subject_id, term_id, exam_type
    """)
    groups = cr.fetchall()
    for class_id, subject_id, term_id, exam_type, max_score, date in groups:
        assessment = env['school.assessment'].create({
            'name': TYPE_LABELS.get(exam_type, exam_type),
            'assessment_type': exam_type,
            'class_id': class_id,
            'subject_id': subject_id,
            'term_id': term_id,
            'date': date,
            'max_mark': max_score or 100.0,
            'state': 'approved',
        })
        cr.execute("""
            UPDATE school_mark
               SET assessment_id = %s
             WHERE assessment_id IS NULL AND class_id = %s
               AND subject_id = %s AND term_id = %s AND exam_type = %s
        """, (assessment.id, class_id, subject_id, term_id, exam_type))

    cr.execute("SELECT count(*) FROM school_mark WHERE assessment_id IS NULL")
    unmatched = cr.fetchone()[0]
    if not unmatched:
        cr.execute("ALTER TABLE school_mark ALTER COLUMN assessment_id SET NOT NULL")

    # The old per-(student, subject, term, type) unique key is superseded by
    # unique(assessment, student); Odoo does not drop removed constraints.
    cr.execute("ALTER TABLE school_mark DROP CONSTRAINT IF EXISTS school_mark_mark_unique")

    cr.execute("""
        INSERT INTO ir_logging (name, type, level, dbname, message, path, func, line,
                                create_uid, write_uid, create_date, write_date)
        VALUES ('school_management', 'server', 'INFO', %s, %s,
                'migrations/17.0.8.0.0/post-migrate.py', 'migrate', '0',
                1, 1, now(), now())
    """, (cr.dbname,
          'Mark migration: %s assessments created as Approved, %s marks unmatched.'
          % (len(groups), unmatched)))
