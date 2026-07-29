from odoo import api, fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    school_staff_ids = fields.One2many(
        'school.staff', 'user_id', string='School Staff Records',
    )
    school_teacher_id = fields.Many2one(
        'school.teacher', string='Teacher Profile', compute='_compute_school_scope',
    )
    school_department = fields.Char(
        string='School Department', compute='_compute_school_scope',
    )
    school_taught_class_ids = fields.Many2many(
        'school.class', string='Taught Classes', compute='_compute_school_scope',
    )
    school_taught_subject_ids = fields.Many2many(
        'school.subject', string='Taught Subjects', compute='_compute_school_scope',
    )
    school_responsibility_list = fields.Json(
        string='School Responsibilities', compute='_compute_school_scope',
        help='Responsibility codes this user holds through active teaching assignments.',
    )

    @api.depends('school_staff_ids')
    def _compute_school_scope(self):
        """Flatten a user's school scope into plain fields so record-rule domains stay
        simple attribute lookups instead of method calls inside safe_eval."""
        for user in self:
            staff = user.school_staff_ids[:1]
            teacher = self.env['school.teacher'].search([('staff_id', 'in', staff.ids)], limit=1)
            assignments = teacher.assignment_ids
            user.school_teacher_id = teacher
            user.school_department = staff.department or ''
            user.school_taught_class_ids = assignments.mapped('class_id')
            user.school_taught_subject_ids = assignments.mapped('subject_id')
            user.school_responsibility_list = sorted(set(assignments.mapped('responsibility')))
