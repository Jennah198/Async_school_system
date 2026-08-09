from odoo import fields, models

class SchoolEnrollment(models.Model):
    _name = 'school.enrollment'
    _description = 'Academic Year Enrollment'
    _order = 'academic_year_id, grade_id, roll_number'

    # Link back to student
    student_id = fields.Many2one(
        'school.student',
        string="Student",
        required=True,
        ondelete='cascade'
    )

    # Academic year
    academic_year_id = fields.Many2one(
        'school.academic.year',
        string="Academic Year",
        required=True
    )

    # Grade / Section / Shift
    grade_id = fields.Many2one(
        'school.class',
        string="Grade",
        required=True
    )
    section_id = fields.Many2one('school.section', string="Section")
    shift = fields.Selection([
        ('morning', 'Morning'),
        ('afternoon', 'Afternoon'),
        ('evening', 'Evening'),
    ], string="Shift")

    # Roll number (unique per grade+section+year)
    roll_number = fields.Integer(string="Roll Number")

    # Admission type
    admission_type = fields.Selection([
        ('new', 'New'),
        ('transfer', 'Transfer'),
        ('returning', 'Returning'),
        ('readmitted', 'Re-Admitted'),
    ], string="Admission Type", required=True)

    # Dates
    enrollment_date = fields.Date(
        string="Enrollment Date",
        default=lambda self: fields.Date.context_today(self)
    )
    end_date = fields.Date(string="End Date")

    # Status
    status = fields.Selection([
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('withdrawn', 'Withdrawn'),
    ], string="Status", default='active')

    # Notes
    notes = fields.Text(string="Notes")

    _sql_constraints = [
        ('unique_roll',
         'unique(academic_year_id, grade_id, section_id, roll_number)',
         'Roll number must be unique within the same academic year, grade, and section.')
    ]
    def action_open_student_dashboard(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'school.student',
            'res_id': self.student_id.id,
            'view_mode': 'form',
            'view_id': self.env.ref('school_management.view_school_student_dashboard_form').id,
            'target': 'current',
        }