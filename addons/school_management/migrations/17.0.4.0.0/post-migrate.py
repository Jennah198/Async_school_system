from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    """Backfill school.enrollment for every approved student.

    Students carried their placement directly in class_id; the enrollment
    model now owns it. One active enrollment per approved student, roll
    numbers assigned sequentially per class in name order. class_id is left
    untouched, so nothing is destroyed if this needs redoing.
    """
    if not version:
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    Enrollment = env['school.enrollment']
    students = env['school.student'].with_context(active_test=False).search([
        ('registration_status', '=', 'approved'),
        ('class_id', '!=', False),
    ], order='class_id, name')

    next_roll = {}
    created = 0
    for student in students:
        if Enrollment.search_count([('student_id', '=', student.id)]):
            continue
        klass = student.class_id
        if klass.id not in next_roll:
            last = Enrollment.search([('class_id', '=', klass.id)],
                                     order='roll_number desc', limit=1)
            next_roll[klass.id] = (last.roll_number or 0) + 1
        Enrollment.create({
            'student_id': student.id,
            'class_id': klass.id,
            'enrollment_date': student.registration_date,
            'roll_number': next_roll[klass.id],
            'state': 'active',
            'active': student.active,
        })
        next_roll[klass.id] += 1
        created += 1

    # Reconciliation total, as the SRS migration section requires.
    cr.execute("SELECT count(*) FROM school_student WHERE registration_status = 'approved'")
    total = cr.fetchone()[0]
    env['ir.logging'].sudo().create({
        'name': 'school_management',
        'type': 'server',
        'level': 'INFO',
        'dbname': cr.dbname,
        'message': 'Enrollment backfill: %s created for %s approved students.' % (created, total),
        'path': 'migrations/17.0.4.0.0/post-migrate.py',
        'func': 'migrate',
        'line': '0',
    })
