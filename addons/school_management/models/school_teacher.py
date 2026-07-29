from odoo import api, fields, models

class SchoolTeacher(models.Model):
    _name = 'school.teacher'
    _description = 'Teacher Profile'
    _order = 'name'

    teacher_id = fields.Char(string='Teacher ID', required=True, copy=False, readonly=True, default='New')
    name = fields.Char(string='Full Name', required=True)

    # Placeholder until school.staff exists — will become a Many2one once Staff Registration is built
    staff_reference = fields.Char(string='Staff ID (temporary reference)',
                                   help='Temporary text reference until school.staff model exists. '
                                        'Will be replaced with a proper link once Staff Registration is built.')

    qualification = fields.Char(string='Highest Qualification')
    specialization = fields.Char(string='Specialization')
    years_of_experience = fields.Integer(string='Years of Experience')
    hire_date = fields.Date(string='Hire / Start Date')

    teaching_status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ], string='Teaching Status', default='active', required=True)

    max_weekly_workload = fields.Integer(string='Maximum Weekly Periods')
    available_days = fields.Char(string='Available Days', help='e.g. Mon-Fri, or specific days')

    assignment_ids = fields.One2many('school.teacher.assignment', 'teacher_id', string='Assignments')

    active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('teacher_id_unique', 'unique(teacher_id)', 'Teacher ID must be unique.'),
    ]
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('teacher_id', 'New') == 'New':
                vals['teacher_id'] = self.env['ir.sequence'].next_by_code('school.teacher') or 'New'
        return super().create(vals_list)