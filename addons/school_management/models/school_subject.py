from odoo import api, fields, models


class SchoolSubject(models.Model):
    _name = 'school.subject'
    _description = 'School Subject'
    _order = 'name'

    sequence_code = fields.Char(string='Subject ID', readonly=True, copy=False)
    name = fields.Char(string='Subject Name', required=True)
    code = fields.Char(string='Subject Code')
    short_name = fields.Char()
    subject_type = fields.Selection([
        ('compulsory', 'Compulsory'), ('optional', 'Optional'),
        ('stream', 'Stream'), ('elective', 'Elective'), ('non_graded', 'Non-Graded'),
    ], default='compulsory', required=True)
    credit_hours = fields.Float(string='Credit Hours', default=1.0)
    active = fields.Boolean(string='Active', default=True)
    grade_subject_ids = fields.One2many(
        'school.grade.subject', 'subject_id', string='Curriculum Offerings')

    _subject_name_unique = models.Constraint(
        'unique(name)',
        'A subject with that name already exists.',
    )
    _credit_hours_positive = models.Constraint(
        'CHECK(credit_hours >= 0)',
        'Credit hours cannot be negative.',
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('sequence_code'):
                vals['sequence_code'] = self.env['ir.sequence'].next_by_code('school.subject') or 'New'
        return super().create(vals_list)

    @api.model
    def _backfill_missing_codes(self):
        subjects = self.search(['|', ('sequence_code', '=', False), ('sequence_code', '=', '')])
        for subject in subjects:
            subject.sequence_code = self.env['ir.sequence'].next_by_code('school.subject') or 'New'