from odoo import api, fields, models
from odoo.exceptions import ValidationError

# Grade boundaries, highest first. First band whose floor the percentage reaches wins.
GRADE_BANDS = [(90, 'A'), (80, 'B'), (70, 'C'), (60, 'D'), (50, 'E')]


class SchoolMark(models.Model):
    _name = 'school.mark'
    _description = 'Student Mark / Result'
    _order = 'academic_year_id, term_id, student_id'

    student_id = fields.Many2one(
        'school.student', string='Student', required=True, ondelete='restrict',
        domain="[('registration_status', '=', 'approved')]",
        help='Only approved student registrations can receive marks.',
    )
    class_id = fields.Many2one(
        'school.class', related='student_id.class_id', string='Grade / Class',
        store=True, readonly=True,
    )
    academic_year_id = fields.Many2one(
        'school.academic.year', related='class_id.academic_year_id',
        string='Academic Year', store=True, readonly=True,
    )
    subject_id = fields.Many2one(
        'school.subject', string='Subject', required=True, ondelete='restrict',
    )
    term_id = fields.Many2one(
        'school.term', string='Term', required=True,
        ondelete='restrict', index=True,
    )
    exam_type = fields.Selection([
        ('quiz', 'Quiz'),
        ('assignment', 'Assignment'),
        ('test', 'Test'),
        ('midterm', 'Mid-term Exam'),
        ('final', 'Final Exam'),
    ], string='Assessment', required=True, default='test')

    score = fields.Float(string='Score', required=True)
    max_score = fields.Float(string='Out Of', required=True, default=100.0)
    percentage = fields.Float(string='Percentage', compute='_compute_percentage', store=True)
    grade = fields.Char(string='Grade', compute='_compute_percentage', store=True)

    recorded_by_id = fields.Many2one(
        'res.users', string='Recorded By', default=lambda self: self.env.user, readonly=True,
    )
    note = fields.Text(string='Remarks')
    active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('mark_unique', 'unique(student_id, subject_id, term_id, exam_type)',
         'This student already has a mark for this subject, term, and assessment.'),
        ('max_score_positive', 'CHECK(max_score > 0)', 'Out Of must be greater than zero.'),
        ('score_not_negative', 'CHECK(score >= 0)', 'Score cannot be negative.'),
    ]

    @api.depends('score', 'max_score')
    def _compute_percentage(self):
        for rec in self:
            rec.percentage = (rec.score / rec.max_score * 100) if rec.max_score else 0.0
            rec.grade = next((g for floor, g in GRADE_BANDS if rec.percentage >= floor), 'F')

    @api.constrains('score', 'max_score')
    def _check_score_within_max(self):
        for rec in self:
            if rec.score > rec.max_score:
                raise ValidationError('Score cannot be greater than Out Of.')

    @api.constrains('student_id', 'subject_id', 'term_id')
    def _check_subject_taught_to_class(self):
        """A mark only makes sense where someone is assigned to teach that subject
        to that class in that term."""
        for rec in self:
            taught = self.env['school.teacher.assignment'].search_count([
                ('subject_id', '=', rec.subject_id.id),
                ('class_id', '=', rec.class_id.id),
                ('term_id', '=', rec.term_id.id),
            ])
            if not taught:
                raise ValidationError(
                    f'{rec.subject_id.name} is not assigned to any teacher for '
                    f'{rec.class_id.display_name} in {rec.term_id.name}.'
                )
