from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    """Seed the curriculum from the marks that already exist, then derive
    subject enrollments for every active enrollment.

    A distinct (class, subject) pair in school_mark means that class was
    taught that subject, so it becomes a compulsory curriculum row. The
    result needs registrar review — the log says so — but it beats an empty
    curriculum that would block mark entry once marks require subject
    enrollment. Redoable: existing rows are skipped.
    """
    if not version:
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    GradeSubject = env['school.grade.subject']

    cr.execute("""
        SELECT DISTINCT class_id, subject_id
          FROM school_mark
         WHERE class_id IS NOT NULL AND subject_id IS NOT NULL
    """)
    pairs = cr.fetchall()
    created = 0
    for class_id, subject_id in pairs:
        if GradeSubject.with_context(active_test=False).search_count([
            ('class_id', '=', class_id), ('subject_id', '=', subject_id),
        ]):
            continue
        GradeSubject.create({'class_id': class_id, 'subject_id': subject_id})
        created += 1

    # create() above already backfilled its own class; this sweep covers
    # enrollments whose class had no marks at all.
    enrollments = env['school.enrollment'].search([('state', '=', 'active')])
    enrollments._derive_subject_enrollments()
    derived = env['school.student.subject'].search_count([])

    env['ir.logging'].sudo().create({
        'name': 'school_management',
        'type': 'server',
        'level': 'INFO',
        'dbname': cr.dbname,
        'message': 'Curriculum backfill: %s curriculum rows inferred from marks '
                   '(review under Registrar > Curriculum), %s subject enrollments '
                   'derived for %s active enrollments.'
                   % (created, derived, len(enrollments)),
        'path': 'migrations/17.0.6.0.0/post-migrate.py',
        'func': 'migrate',
        'line': '0',
    })
