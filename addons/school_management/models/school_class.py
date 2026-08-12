from odoo import api, fields, models # type: ignore
from odoo.exceptions import ValidationError


class SchoolClass(models.Model):
    _name = 'school.class'
    _description = 'School Grade / Class'
    _order = 'name, section_id, academic_year_id'

    name = fields.Char(string='Grade / Class', required=True)
    grade_id = fields.Many2one('school.grade', string='Grade', ondelete='restrict', index=True)
    section_id = fields.Many2one(
        'school.section', string='Section', ondelete='restrict', index=True,
    )
    academic_year_id = fields.Many2one(
        'school.academic.year', string='Academic Year', required=True,
        ondelete='restrict', index=True,
        default=lambda self: self.env['school.academic.year']._default_year(),
    )
    student_ids = fields.One2many('school.student', 'class_id', string='Students')
    enrollment_ids = fields.One2many('school.enrollment', 'class_id', string='Enrollments')
    capacity = fields.Integer(
        string='Capacity',
        help='Maximum active enrollments. 0 means unlimited.',
    )
    shift_id = fields.Many2one('school.shift', ondelete='restrict')
    stream_id = fields.Many2one('school.stream', ondelete='restrict')
    campus_id = fields.Many2one('school.campus', ondelete='restrict')
    homeroom_teacher_id = fields.Many2one('school.teacher', ondelete='restrict')

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

    _class_section_year_unique = models.Constraint(
        'unique(name, section_id, academic_year_id)',
        'This class/section already exists for this academic year.',
    )
    _age_range_valid = models.Constraint(
        'CHECK(min_age <= max_age OR min_age = 0 OR max_age = 0)',
        'Minimum age cannot be greater than maximum age.',
    )
    _capacity_nonnegative = models.Constraint(
        'CHECK(capacity >= 0)',
        'Capacity cannot be negative.',
    )

    @api.onchange('grade_id')
    def _onchange_grade_id(self):
        for rec in self:
            if rec.grade_id and rec.grade_id.level not in ('11', '12'):
                rec.stream_id = False

    @api.constrains('grade_id', 'stream_id')
    def _check_stream_grade(self):
        for rec in self.filtered('stream_id'):
            if not rec.grade_id or rec.grade_id.level not in ('11', '12'):
                raise ValidationError(
                    'Academic streams are only available for Grades 11 and 12.')
