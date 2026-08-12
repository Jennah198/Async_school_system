from odoo import api, fields, models
from odoo.exceptions import ValidationError


class SchoolTerm(models.Model):
    _name = 'school.term'
    _description = 'Academic Term'
    # Dependent models order on term_id and resolve through this, so keep it the
    # natural teaching order rather than alphabetical.
    _order = 'sequence, name'

    name = fields.Char(string='Term', required=True)
    academic_year_id = fields.Many2one(
        'school.academic.year', required=True, ondelete='cascade', index=True,
        default=lambda self: self.env['school.academic.year']._default_year(),
    )
    date_start = fields.Date(required=True)
    date_end = fields.Date(required=True)
    sequence = fields.Integer(string='Sequence', default=10)
    active = fields.Boolean(string='Active', default=True)

    _name_year_unique = models.Constraint(
        'unique(name, academic_year_id)',
        'That term already exists in this academic year.',
    )
    _term_date_order = models.Constraint(
        'CHECK(date_end >= date_start)',
        'The term end date must not be before its start date.',
    )

    @api.constrains('academic_year_id', 'date_start', 'date_end')
    def _check_within_academic_year(self):
        for rec in self:
            year = rec.academic_year_id
            if year.date_start and rec.date_start < year.date_start:
                raise ValidationError('The term cannot start before its academic year.')
            if year.date_end and rec.date_end > year.date_end:
                raise ValidationError('The term cannot end after its academic year.')


class SchoolSection(models.Model):
    _name = 'school.section'
    _description = 'Class Section'
    _order = 'sequence, name'

    name = fields.Char(string='Section', required=True, help='For example A, B, or C.')
    sequence = fields.Integer(string='Sequence', default=10)
    active = fields.Boolean(string='Active', default=True)

    _name_unique = models.Constraint(
        'unique(name)',
        'That section already exists.',
    )
