from odoo import api, fields, models
from odoo.exceptions import ValidationError


class SchoolTeacherAssignment(models.Model):
    _name = 'school.teacher.assignment'
    _description = 'Teacher Subject / Class Assignment'
    _order = 'academic_year desc, term'

    start_date = fields.Date(string='Start Date', required=True, default=lambda self: fields.Date.context_today(self))
    end_date = fields.Date(string='End Date')
    teacher_id = fields.Many2one('school.teacher', string='Teacher', required=True, ondelete='cascade')
    subject_id = fields.Many2one('school.subject', string='Subject', required=True)
    class_id = fields.Many2one('school.class', string='Grade / Class', required=True)
    academic_year = fields.Char(string='Academic Year', required=True)
    term = fields.Selection([
        ('term1', 'Term 1'),
        ('term2', 'Term 2'),
    ], string='Term', required=True)
    responsibility = fields.Selection([
        ('teacher', 'Teacher'),
        ('homeroom', 'Homeroom Teacher'),
        ('department_head', 'Department Head'),
        ('coordinator', 'Academic Coordinator'),
    ], string='Responsibility', default='teacher', required=True)
    active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('unique_assignment', 'unique(teacher_id, subject_id, class_id, academic_year, term)',
         'This teacher already has an identical assignment for this subject, class, year, and term.'),
    ]

    @api.constrains('teacher_id', 'subject_id')
    def _check_teacher_and_subject_active(self):
        for rec in self:
            if rec.teacher_id.teaching_status != 'active':
                raise ValidationError('Cannot create an assignment for an inactive teacher.')
            if not rec.subject_id.active:
                raise ValidationError('Cannot assign an inactive subject.')
   
    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for rec in self:
            if rec.end_date and rec.end_date < rec.start_date:
                raise ValidationError('End date cannot be before the start date.')

   