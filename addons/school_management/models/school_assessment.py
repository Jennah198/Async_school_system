from odoo import api, fields, models
from odoo.exceptions import AccessError, ValidationError

ASSESSMENT_TYPES = [
    ('quiz', 'Quiz'),
    ('assignment', 'Assignment'),
    ('test', 'Test'),
    ('midterm', 'Mid-term Exam'),
    ('final', 'Final Exam'),
]

# Setup is frozen once the mark list exists: rows were derived from it.
SETUP_FIELDS = {'class_id', 'subject_id', 'term_id', 'date', 'max_mark', 'assessment_type'}


class SchoolAssessment(models.Model):
    """An assessment and its mark list (SRS §9). The mark list is generated
    from subject enrollments, never typed in, and the rows are only editable
    while the assessment is open."""
    _name = 'school.assessment'
    _description = 'Assessment / Mark List'
    _inherit = ['mail.thread']
    _order = 'date desc, id desc'

    name = fields.Char(string='Assessment Name', required=True)
    assessment_type = fields.Selection(
        ASSESSMENT_TYPES, string='Type', required=True, default='test')
    class_id = fields.Many2one(
        'school.class', string='Grade / Class', required=True, ondelete='restrict')
    subject_id = fields.Many2one(
        'school.subject', string='Subject', required=True, ondelete='restrict')
    term_id = fields.Many2one(
        'school.term', string='Term', required=True, ondelete='restrict')
    academic_year_id = fields.Many2one(
        'school.academic.year', related='class_id.academic_year_id',
        string='Academic Year', store=True, readonly=True)
    date = fields.Date(
        string='Assessment Date', required=True,
        default=lambda self: fields.Date.context_today(self))
    max_mark = fields.Float(string='Maximum Mark', required=True, default=100.0)
    weight = fields.Float(
        string='Weight', default=1.0,
        help='Contribution of this assessment to the term result.')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('locked', 'Locked'),
        ('published', 'Published'),
    ], default='draft', required=True, tracking=True)

    mark_ids = fields.One2many('school.mark', 'assessment_id', string='Mark List')
    mark_count = fields.Integer(compute='_compute_mark_count')

    _sql_constraints = [
        ('max_mark_positive', 'CHECK(max_mark > 0)',
         'Maximum Mark must be greater than zero.'),
        ('weight_not_negative', 'CHECK(weight >= 0)',
         'Weight cannot be negative.'),
    ]

    @api.depends('mark_ids')
    def _compute_mark_count(self):
        for rec in self:
            rec.mark_count = len(rec.mark_ids)

    def write(self, vals):
        if SETUP_FIELDS & vals.keys() and any(r.state != 'draft' for r in self):
            raise ValidationError(
                'Assessment setup is frozen once the mark list is generated.')
        # BR-11 / AC-13: only an Exam Officer moves a mark list past Submitted
        # or reopens one, whichever path the write arrives through.
        if vals.get('state') in ('approved', 'locked', 'published'):
            self._require_exam_officer()
        if vals.get('state') == 'open' and any(
                r.state not in ('draft', 'open') for r in self):
            self._require_exam_officer()
        return super().write(vals)

    def unlink(self):
        if any(r.state != 'draft' for r in self):
            raise ValidationError('Only draft assessments can be deleted.')
        return super().unlink()

    def _require_exam_officer(self):
        if self.env.su:
            return
        if not self.env.user.has_group('school_management.group_school_exam_officer'):
            raise AccessError('Only an Exam Officer can do this.')

    def _check_teacher_assigned(self):
        """BR-05: no mark list without an active teacher subject assignment."""
        for rec in self:
            assigned = self.env['school.teacher.assignment'].search_count([
                ('subject_id', '=', rec.subject_id.id),
                ('class_id', '=', rec.class_id.id),
                ('term_id', '=', rec.term_id.id),
            ])
            if not assigned:
                raise ValidationError(
                    f'{rec.subject_id.name} has no teacher assigned for '
                    f'{rec.class_id.display_name} in {rec.term_id.name}.')

    def _generate_mark_list(self):
        """BR-06 / AC-06: rows come from subject enrollments valid at the
        assessment date. AC-07 / BR-10: a student enrolled after the date is
        simply not listed — never given a zero."""
        self.ensure_one()
        enrolled = self.env['school.student.subject'].search([
            ('grade_subject_id.class_id', '=', self.class_id.id),
            ('subject_id', '=', self.subject_id.id),
            ('state', '=', 'enrolled'),
            ('enrollment_id.state', '!=', 'draft'),
            ('enrollment_id.enrollment_date', '<=', self.date),
            '|', ('enrollment_id.end_date', '=', False),
                 ('enrollment_id.end_date', '>=', self.date),
        ])
        listed = set(self.mark_ids.mapped('student_id').ids)
        vals_list = []
        for line in enrolled:
            if line.student_id.id in listed:
                continue
            listed.add(line.student_id.id)
            vals_list.append({
                'assessment_id': self.id,
                'student_id': line.student_id.id,
                'mark_status': 'pending',
            })
        self.env['school.mark'].create(vals_list)

    def action_open(self):
        for rec in self:
            if rec.state != 'draft':
                raise ValidationError('Only draft assessments can be opened.')
            rec._check_teacher_assigned()
            rec.state = 'open'
            rec._generate_mark_list()

    def action_regenerate(self):
        """Pick up subject enrollments added since opening. Idempotent."""
        for rec in self:
            if rec.state != 'open':
                raise ValidationError('Only open assessments can be regenerated.')
            rec._generate_mark_list()

    def action_submit(self):
        self._transition('open', 'submitted')

    def action_return(self):
        self._require_exam_officer()
        self._transition('submitted', 'open')

    def action_approve(self):
        self._transition('submitted', 'approved')

    def action_lock(self):
        self._transition('approved', 'locked')

    def action_publish(self):
        self._transition('locked', 'published')

    def _transition(self, src, dst):
        for rec in self:
            if rec.state != src:
                raise ValidationError(
                    f'Only {src} assessments can move to {dst}.')
            rec.state = dst


class SchoolAssessmentUnlock(models.TransientModel):
    """BR-11 / AC-13: approved or locked marks reopen only through here, with
    a reason that lands on the assessment's audit trail."""
    _name = 'school.assessment.unlock'
    _description = 'Unlock Assessment for Correction'

    assessment_id = fields.Many2one(
        'school.assessment', string='Assessment', required=True,
        domain=[('state', 'in', ('approved', 'locked', 'published'))])
    reason = fields.Text(string='Reason', required=True)

    def action_confirm(self):
        self.ensure_one()
        assessment = self.assessment_id
        assessment._require_exam_officer()
        if assessment.state not in ('approved', 'locked', 'published'):
            raise ValidationError('This assessment is not locked.')
        assessment.message_post(body='Unlocked for correction: %s' % self.reason)
        assessment.state = 'open'
