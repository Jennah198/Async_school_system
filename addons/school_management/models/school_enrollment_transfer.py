from odoo import fields, models
from odoo.exceptions import ValidationError


class SchoolEnrollmentTransfer(models.TransientModel):
    """Section transfer (SRS §11.1): close the old enrollment on the
    effective date, open a new one in the target class. History — rolls,
    attendance, marks — stays on the old enrollment untouched."""
    _name = 'school.enrollment.transfer'
    _description = 'Section Transfer'

    enrollment_id = fields.Many2one(
        'school.enrollment', string='Current Enrollment', required=True,
        domain=[('state', '=', 'active')],
    )
    new_class_id = fields.Many2one(
        'school.class', string='New Grade / Class', required=True,
    )
    effective_date = fields.Date(
        string='Effective Date', required=True,
        default=lambda self: fields.Date.context_today(self),
    )

    def action_confirm(self):
        self.ensure_one()
        old = self.enrollment_id
        if old.state != 'active':
            raise ValidationError('Only active enrollments can be transferred.')
        if self.new_class_id == old.class_id:
            raise ValidationError('The student is already in %s.'
                                  % old.class_id.display_name)
        if self.effective_date < old.enrollment_date:
            raise ValidationError('The transfer cannot take effect before the '
                                  'current enrollment started (%s).'
                                  % old.enrollment_date)
        old.write({'state': 'transferred', 'end_date': self.effective_date})
        new = self.env['school.enrollment'].create({
            'student_id': old.student_id.id,
            'class_id': self.new_class_id.id,
            'enrollment_date': self.effective_date,
            'admission_type': old.admission_type,
        })
        new.action_activate()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'school.enrollment',
            'view_mode': 'form',
            'res_id': new.id,
        }
