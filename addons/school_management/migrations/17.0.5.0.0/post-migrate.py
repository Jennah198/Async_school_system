from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    """Backfill partner-backed guardian links from the intake chars.

    Every student with a guardian name gets a primary school.student.guardian
    row. Contacts are deduplicated on (name, normalized phone) so one parent
    with several children becomes a single res.partner. The chars are left
    untouched, so this is redoable.
    """
    if not version:
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    Partner = env['res.partner']
    Guardian = env['school.student.guardian']
    students = env['school.student'].with_context(active_test=False).search([
        ('guardian_name', '!=', False),
    ])

    partners = {}
    created = 0
    for student in students:
        if Guardian.search_count([('student_id', '=', student.id)]):
            continue
        phone = student._get_full_phone(student.guardian_phone)
        key = (student.guardian_name, phone)
        if key not in partners:
            partners[key] = Partner.search([
                ('name', '=', student.guardian_name),
                ('phone', '=', phone),
            ], limit=1) or Partner.create({
                'name': student.guardian_name,
                'phone': phone,
                'type': 'contact',
            })
        Guardian.create({
            'student_id': student.id,
            'partner_id': partners[key].id,
            'is_primary': True,
        })
        created += 1

    env['ir.logging'].sudo().create({
        'name': 'school_management',
        'type': 'server',
        'level': 'INFO',
        'dbname': cr.dbname,
        'message': 'Guardian backfill: %s links created (%s contacts) for %s students.'
                   % (created, len(partners), len(students)),
        'path': 'migrations/17.0.5.0.0/post-migrate.py',
        'func': 'migrate',
        'line': '0',
    })
