from odoo import api, fields, models
from odoo.exceptions import ValidationError


class SchoolTeacherAssignment(models.Model):
    _name = 'school.teacher.assignment'
    _description = 'Teacher Subject / Class Assignment'
    _inherit = ['mail.thread']
    _order = 'academic_year desc, term'

    name = fields.Char(string='Assignment', compute='_compute_name', store=True)
    weekly_periods = fields.Integer(string='Periods per Week', default=1, required=True)
    start_date = fields.Date(string='Start Date', required=True, default=lambda self: fields.Date.context_today(self))
    end_date = fields.Date(string='End Date')
    teacher_id = fields.Many2one('school.teacher', string='Teacher', required=True, ondelete='cascade')
    subject_id = fields.Many2one('school.subject', string='Subject', required=True)
    class_id = fields.Many2one('school.class', string='Grade / Class', required=True)
    academic_year = fields.Char(related='class_id.academic_year', store=True, readonly=True, string='Academic Year')
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

    @api.constrains('subject_id', 'class_id', 'academic_year', 'term', 'active')
    def _check_single_teacher_per_subject_class_term(self):
        """Brief section 6: one active teacher per subject/class/section for a given academic period."""
        for rec in self.filtered(lambda r: r.active):
            clash = self.search([
                ('id', '!=', rec.id),
                ('subject_id', '=', rec.subject_id.id),
                ('class_id', '=', rec.class_id.id),
                ('academic_year', '=', rec.academic_year),
                ('term', '=', rec.term),
                ('active', '=', True),
            ], limit=1)
            if clash:
                raise ValidationError(
                    f'{rec.class_id.display_name} already has {clash.teacher_id.name} teaching '
                    f'{rec.subject_id.name} for {rec.academic_year} {rec.term}.'
                )

    @api.constrains('responsibility', 'class_id', 'academic_year', 'term', 'active')
    def _check_single_homeroom_per_class(self):
        """Brief section 6: one active homeroom teacher per class/section and period."""
        for rec in self.filtered(lambda r: r.responsibility == 'homeroom' and r.active):
            clash = self.search([
                ('id', '!=', rec.id),
                ('responsibility', '=', 'homeroom'),
                ('class_id', '=', rec.class_id.id),
                ('academic_year', '=', rec.academic_year),
                ('term', '=', rec.term),
            ], limit=1)
            if clash:
                raise ValidationError(
                    f'{rec.class_id.display_name} already has {clash.teacher_id.name} as '
                    f'homeroom teacher for {rec.academic_year} {rec.term}.'
                )

    @api.constrains('teacher_id')
    def _check_staff_can_take_work(self):
        """Brief section 4: suspended or inactive staff take no new assignments."""
        for rec in self:
            state = rec.teacher_id.staff_id.state
            if state in ('suspended', 'inactive', 'archived'):
                raise ValidationError(
                    f'{rec.teacher_id.name} is {state} as a staff member and cannot '
                    'receive new assignments.'
                )

    @api.constrains('teacher_id', 'subject_id', 'start_date')
    def _check_teacher_and_subject_active(self):
        today = fields.Date.context_today(self)
        for rec in self:
            if rec.start_date and rec.start_date > today:
                if rec.teacher_id.teaching_status != 'active' or not rec.teacher_id.active:
                    raise ValidationError('Cannot create a future assignment for an inactive teacher.')
            if not rec.subject_id.active:
                raise ValidationError('Cannot assign an inactive subject.')
    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for rec in self:
            if rec.end_date and rec.end_date < rec.start_date:
                raise ValidationError('End date cannot be before the start date.')

    @api.constrains('weekly_periods', 'teacher_id', 'active')
    def _check_workload(self):
        for rec in self:
            if not rec.teacher_id.max_weekly_workload:
                continue
            total = sum(rec.teacher_id.assignment_ids.filtered(
                lambda a: a.active
            ).mapped('weekly_periods'))
            if total > rec.teacher_id.max_weekly_workload:
                raise ValidationError(
                    'This assignment brings %s to %s weekly periods, exceeding their maximum of %s.'
                    % (rec.teacher_id.name, total, rec.teacher_id.max_weekly_workload)
                )
    @api.depends('teacher_id', 'subject_id', 'class_id', 'term')
    def _compute_name(self):
        for rec in self:
            rec.name = '%s - %s (%s, %s)' % (
                rec.teacher_id.name or '?',
                rec.subject_id.name or '?',
                rec.class_id.name or '?',
                dict(rec._fields['term'].selection).get(rec.term, '')
            )