from odoo import fields, models


class SchoolSubject(models.Model):
    _name = 'school.subject'
    _description = 'School Subject'
    _order = 'name'

    name = fields.Char(string='Subject Name', required=True)
    code = fields.Char(string='Subject Code')
    education_level = fields.Selection([
        ('kindergarten', 'Kindergarten'),
        ('primary', 'Primary'),
        ('secondary', 'Secondary'),
        ('high_school', 'High School'),
    ], string='Education Level')
    active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('subject_name_unique', 'unique(name, education_level)',
         'This subject already exists for this education level.'),
    ]