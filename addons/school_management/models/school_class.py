from odoo import fields, models # type: ignore


class SchoolClass(models.Model):
    _name = 'school.class'
    _description = 'School Grade / Class'
    _order = 'name, section_id, academic_year_id'

    name = fields.Char(string='Grade / Class', required=True)
    section_id = fields.Many2one(
        'school.section', string='Section', ondelete='restrict', index=True,
    )
    academic_year_id = fields.Many2one(
        'school.academic.year', string='Academic Year', required=True,
        ondelete='restrict', index=True,
        default=lambda self: self.env['school.academic.year']._default_year(),
    )
    student_ids = fields.One2many('school.student', 'class_id', string='Students')

    education_level = fields.Selection([
        ('kindergarten', 'Kindergarten'),
        ('primary', 'Primary'),
        ('secondary', 'Secondary'),
        ('high_school', 'High School'),
    ], string='Education Level')

    is_entry_level = fields.Boolean(
        string='Entry Level (no previous school expected)',
        help='Check this for the very first class a student can join (e.g. KG1). '
             'Students in this class will not be required to upload a previous-grade document.'
    )

    min_age = fields.Integer(string='Minimum Age')
    max_age = fields.Integer(string='Maximum Age')

    active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('class_section_year_unique', 'unique(name, section_id, academic_year_id)',
         'This class/section already exists for this academic year.'),
        ('age_range_valid', 'CHECK(min_age <= max_age OR min_age = 0 OR max_age = 0)',
         'Minimum age cannot be greater than maximum age.'),
    ]
