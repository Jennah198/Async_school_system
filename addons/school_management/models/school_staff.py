from odoo import api, fields, models
from odoo.exceptions import ValidationError


class SchoolJobTitle(models.Model):
    _name = 'school.job.title'
    _description = 'Job Title'
    _order = 'name'

    name = fields.Char(string='Job Title', required=True)
    department = fields.Selection([
        ('administration', 'Administration'),
        ('academic', 'Academic'),
        ('finance', 'Finance'),
        ('it', 'IT'),
        ('library', 'Library'),
        ('facilities', 'Facilities'),
        ('counseling', 'Counseling'),
        ('sports', 'Sports'),
    ], string='Department', required=True)

    _sql_constraints = [
        ('name_department_unique', 'unique(name, department)',
         'This job title already exists for this department.'),
    ]


class SchoolStaff(models.Model):
    _name = 'school.staff'
    _description = 'Staff Registration'
    _order = 'name'

    staff_id = fields.Char(
        string='Staff ID', required=True, copy=False,
        readonly=True, default='New',
    )
    name = fields.Char(string='Full Name', required=True)
    photo = fields.Image(string='Photo', max_width=256, max_height=256)
    gender = fields.Selection([
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ], string='Gender')
    date_of_birth = fields.Date(string='Date of Birth')

    phone = fields.Char(string='Phone')
    mobile = fields.Char(string='Mobile')
    email = fields.Char(string='Email')
    address = fields.Text(string='Address')
    emergency_contact_name = fields.Char(string='Emergency Contact')
    emergency_contact_phone = fields.Char(string='Emergency Phone')

    department = fields.Selection([
        ('administration', 'Administration'),
        ('academic', 'Academic'),
        ('finance', 'Finance'),
        ('it', 'IT'),
        ('library', 'Library'),
        ('facilities', 'Facilities'),
        ('counseling', 'Counseling'),
        ('sports', 'Sports'),
    ], string='Department')
    job_title_id = fields.Many2one(
        'school.job.title', string='Job Title',
        domain="[('department', '=', department)]",
    )
    employment_type = fields.Selection([
        ('full_time', 'Full Time'),
        ('part_time', 'Part Time'),
        ('contract', 'Contract'),
        ('intern', 'Intern'),
    ], string='Employment Type')
    hire_date = fields.Date(string='Hire Date')
    end_date = fields.Date(string='End Date')
    employment_status = fields.Selection([
        ('active', 'Active'),
        ('on_leave', 'On Leave'),
        ('resigned', 'Resigned'),
        ('terminated', 'Terminated'),
        ('retired', 'Retired'),
    ], string='Employment Status', default='active')
    notes = fields.Text(string='Notes')

    active = fields.Boolean(string='Active', default=True)
    user_id = fields.Many2one('res.users', string='Linked User')

    _sql_constraints = [
        ('staff_id_unique', 'unique(staff_id)',
         'Staff ID must be unique.'),
        ('end_date_after_hire', 'CHECK(end_date IS NULL OR hire_date IS NULL OR end_date >= hire_date)',
         'End date cannot be before hire date.'),
    ]

    @api.onchange('department')
    def _onchange_department(self):
        """Clear job title when department changes (old title may not belong to new department)."""
        self.job_title_id = False

    @api.constrains('date_of_birth')
    def _check_date_of_birth(self):
        today = fields.Date.context_today(self)
        for rec in self:
            if rec.date_of_birth and rec.date_of_birth >= today:
                raise ValidationError("Date of birth must be in the past.")

    @api.constrains('email')
    def _check_email(self):
        for rec in self:
            if rec.email and '@' not in rec.email:
                raise ValidationError("Please enter a valid email address.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('staff_id', 'New') == 'New':
                vals['staff_id'] = (
                    self.env['ir.sequence'].next_by_code('school.staff') or 'New'
                )
        return super().create(vals_list)
