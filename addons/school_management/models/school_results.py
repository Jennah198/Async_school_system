from odoo import api, fields, models
from odoo.exceptions import AccessError, ValidationError


class SchoolGradingScheme(models.Model):
    _name = 'school.grading.scheme'
    _description = 'Grading Scheme'
    _order = 'company_id, name'

    name = fields.Char(required=True, translate=True)
    company_id = fields.Many2one(
        'res.company', required=True, default=lambda self: self.env.company,
        ondelete='cascade')
    pass_percentage = fields.Float(default=50.0, required=True)
    band_ids = fields.One2many('school.grading.band', 'scheme_id', string='Bands')
    active = fields.Boolean(default=True)

    _grading_name_company_unique = models.Constraint(
        'unique(name, company_id)', 'Grading scheme names must be unique per school.')
    _grading_pass_range = models.Constraint(
        'CHECK(pass_percentage >= 0 AND pass_percentage <= 100)',
        'Pass percentage must be between 0 and 100.')

    def grade_for(self, percentage):
        self.ensure_one()
        return self.band_ids.filtered(
            lambda band: band.minimum_percentage <= percentage <= band.maximum_percentage
        ).sorted('minimum_percentage', reverse=True)[:1]


class SchoolGradingBand(models.Model):
    _name = 'school.grading.band'
    _description = 'Grading Band'
    _order = 'minimum_percentage desc'

    scheme_id = fields.Many2one(
        'school.grading.scheme', required=True, ondelete='cascade')
    name = fields.Char(required=True, translate=True)
    minimum_percentage = fields.Float(required=True)
    maximum_percentage = fields.Float(required=True, default=100.0)
    remark = fields.Char(translate=True)

    _grading_band_range = models.Constraint(
        'CHECK(minimum_percentage >= 0 AND maximum_percentage <= 100 '
        'AND maximum_percentage >= minimum_percentage)',
        'Grading band percentages must form a valid range between 0 and 100.')

    @api.constrains('scheme_id', 'minimum_percentage', 'maximum_percentage')
    def _check_overlap(self):
        for band in self:
            overlap = self.search([
                ('id', '!=', band.id), ('scheme_id', '=', band.scheme_id.id),
                ('minimum_percentage', '<=', band.maximum_percentage),
                ('maximum_percentage', '>=', band.minimum_percentage),
            ], limit=1)
            if overlap:
                raise ValidationError('Grading bands cannot overlap.')


class SchoolReportCard(models.Model):
    _name = 'school.report.card'
    _description = 'Versioned Student Report Card'
    _inherit = ['mail.thread']
    _order = 'student_id, term_id, version desc'

    name = fields.Char(required=True, readonly=True, copy=False)
    student_id = fields.Many2one(
        'school.student', required=True, ondelete='restrict', index=True)
    enrollment_id = fields.Many2one(
        'school.enrollment', required=True, ondelete='restrict', index=True)
    term_id = fields.Many2one('school.term', required=True, ondelete='restrict', index=True)
    academic_year_id = fields.Many2one(
        related='enrollment_id.academic_year_id', store=True, index=True)
    class_id = fields.Many2one(related='enrollment_id.class_id', store=True)
    version = fields.Integer(required=True, readonly=True, copy=False)
    supersedes_id = fields.Many2one('school.report.card', ondelete='restrict', readonly=True)
    superseded_by_id = fields.Many2one(
        'school.report.card', ondelete='restrict', readonly=True, copy=False)
    grading_scheme_id = fields.Many2one(
        'school.grading.scheme', required=True, ondelete='restrict')
    result_snapshot = fields.Json(required=True, readonly=True, copy=False)
    attendance_summary = fields.Json(readonly=True, copy=False)
    overall_average = fields.Float(readonly=True, copy=False)
    result = fields.Selection(
        [('pass', 'Pass'), ('fail', 'Fail')], readonly=True, copy=False)
    state = fields.Selection([
        ('draft', 'Draft'), ('approved', 'Approved'),
        ('published', 'Published'), ('superseded', 'Superseded'),
    ], default='draft', required=True, tracking=True)
    approved_by_id = fields.Many2one('res.users', readonly=True, copy=False)
    approved_at = fields.Datetime(readonly=True, copy=False)
    published_at = fields.Datetime(readonly=True, copy=False)
    correction_reason = fields.Text(copy=False)

    _report_card_version_unique = models.Constraint(
        'unique(student_id, term_id, version)',
        'Report card versions must be unique for each student and term.')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            student = self.env['school.student'].browse(vals['student_id'])
            term = self.env['school.term'].browse(vals['term_id'])
            previous = self.search([
                ('student_id', '=', student.id), ('term_id', '=', term.id),
            ], order='version desc', limit=1)
            vals['version'] = previous.version + 1 if previous else 1
            vals['name'] = '%s - %s - v%s' % (student.name, term.name, vals['version'])
            vals.setdefault('supersedes_id', previous.id)
        return super().create(vals_list)

    @api.model
    def generate_for(self, student, term, correction_reason=None):
        enrollment = self.env['school.enrollment'].search([
            ('student_id', '=', student.id),
            ('academic_year_id', '=', term.academic_year_id.id),
        ], limit=1)
        if not enrollment:
            raise ValidationError('The student has no enrollment for this term.')
        scheme = self.env.company.school_grading_scheme_id
        if not scheme or not scheme.band_ids:
            raise ValidationError('Configure a grading scheme and bands first.')
        marks = self.env['school.mark'].search([
            ('student_id', '=', student.id), ('term_id', '=', term.id),
            ('assessment_id.state', '=', 'published'),
            ('mark_status', 'in', ('recorded', 'transfer')),
        ])
        if not marks:
            raise ValidationError('No published marks are available for this report card.')
        grouped = {}
        for mark in marks:
            row = grouped.setdefault(mark.subject_id.id, {
                'subject': mark.subject_id.name, 'raw_total': 0.0,
                'maximum_total': 0.0, 'weighted_total': 0.0,
            })
            row['raw_total'] += mark.score
            row['maximum_total'] += mark.max_score
            row['weighted_total'] += mark.weighted_score
        results = []
        for values in grouped.values():
            percentage = (values['raw_total'] / values['maximum_total'] * 100.0)
            band = scheme.grade_for(percentage)
            values.update({
                'percentage': percentage, 'grade': band.name if band else False,
                'pass': percentage >= scheme.pass_percentage,
            })
            results.append(values)
        average = sum(row['percentage'] for row in results) / len(results)
        attendance = self.env['school.attendance']._read_group(
            [('student_id', '=', student.id),
             ('date', '>=', term.date_start), ('date', '<=', term.date_end)],
            ['status'], ['__count'])
        return self.create({
            'student_id': student.id, 'enrollment_id': enrollment.id,
            'term_id': term.id, 'grading_scheme_id': scheme.id,
            'result_snapshot': results,
            'attendance_summary': {status: count for status, count in attendance},
            'overall_average': average,
            'result': 'pass' if all(row['pass'] for row in results) else 'fail',
            'correction_reason': correction_reason,
        })

    def _require_exam_officer(self):
        if not self.env.su and not self.env.user.has_group(
                'school_management.group_school_exam_officer'):
            raise AccessError('Only an Exam Officer can approve or publish report cards.')

    def action_approve(self):
        self._require_exam_officer()
        self.filtered(lambda card: card.state == 'draft').write({
            'state': 'approved', 'approved_by_id': self.env.user.id,
            'approved_at': fields.Datetime.now(),
        })

    def action_publish(self):
        self._require_exam_officer()
        for card in self:
            if card.state != 'approved':
                raise ValidationError('Only approved report cards can be published.')
            previous = card.supersedes_id.filtered(lambda item: item.state == 'published')
            if previous:
                previous.write({'state': 'superseded', 'superseded_by_id': card.id})
            card.write({'state': 'published', 'published_at': fields.Datetime.now()})

    def unlink(self):
        raise AccessError('Report card versions are permanent academic records.')


class ResCompanySchoolResults(models.Model):
    _inherit = 'res.company'

    school_grading_scheme_id = fields.Many2one(
        'school.grading.scheme', string='Active Grading Scheme', ondelete='restrict')
