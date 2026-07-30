from odoo import api, fields, models
from odoo.exceptions import ValidationError


class SchoolTeacher(models.Model):
    _name = 'school.teacher'
    _description = 'Teacher Profile'
    _order = 'name'

    teacher_id = fields.Char(string='Teacher ID', required=True, copy=False, readonly=True, default='New')
    # Brief section 5: the name is inherited from the staff master record, so renaming
    # the staff member flows through to assignments and schedules.
    name = fields.Char(
        string='Full Name', related='staff_id.name', store=True, readonly=True,
    )

    staff_id = fields.Many2one('school.staff', string='Staff Record', required=True, ondelete='restrict',
                                domain="[('employment_status', '=', 'active')]",
                                help='Link to the official staff master record.')

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
        ('staff_id_unique', 'unique(staff_id)', 'This staff member already has a teacher profile.'),
    ]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('teacher_id', 'New') == 'New':
                vals['teacher_id'] = self.env['ir.sequence'].next_by_code('school.teacher') or 'New'
        return super().create(vals_list)