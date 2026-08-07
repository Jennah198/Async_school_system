from odoo import api, fields, models # type: ignore


class SchoolClass(models.Model):
    _name = 'school.class'
    _description = 'School Grade / Class'
    _order = 'name, section, academic_year'

    name = fields.Char(string='Grade / Class', required=True)
    section = fields.Char(string='Section')
    academic_year = fields.Selection(
        selection='_get_academic_year_selection', string='Academic Year', required=True,
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
        ('class_section_year_unique', 'unique(name, section, academic_year)',
         'This class/section already exists for this academic year.'),
        ('age_range_valid', 'CHECK(min_age <= max_age OR min_age = 0 OR max_age = 0)',
         'Minimum age cannot be greater than maximum age.'),
    ]

    @api.model
    def _get_academic_year_selection(self):
        """Current year plus the next four, unioned with every year already stored.

        The union is what keeps history readable. A window alone drops a year the
        moment it lapses, and a Selection renders blank for any value missing from
        its list — so on 1 January every existing class, mark, and schedule would
        show an empty required field and force whoever edits it to re-pick a year.
        """
        start = fields.Date.context_today(self).year
        years = {'%d/%d' % (y, y + 1) for y in range(start, start + 5)}
        # Raw SQL: this runs during field setup, where the ORM is not yet usable.
        self.env.cr.execute("SELECT to_regclass('school_class')")
        if self.env.cr.fetchone()[0]:
            self.env.cr.execute(
                'SELECT DISTINCT academic_year FROM school_class '
                'WHERE academic_year IS NOT NULL'
            )
            years.update(row[0] for row in self.env.cr.fetchall())
        return [(year, year) for year in sorted(years)]