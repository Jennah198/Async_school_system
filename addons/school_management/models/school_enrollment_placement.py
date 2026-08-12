from odoo import api, fields, models
from odoo.exceptions import AccessError, ValidationError


class SchoolEnrollmentPlacement(models.Model):
    _name = 'school.enrollment.placement'
    _description = 'Effective-Dated Enrollment Placement'
    _inherit = ['mail.thread']
    _order = 'date_start desc, id desc'

    enrollment_id = fields.Many2one(
        'school.enrollment', required=True, ondelete='restrict', index=True)
    student_id = fields.Many2one(
        related='enrollment_id.student_id', store=True, index=True)
    academic_year_id = fields.Many2one(
        related='enrollment_id.academic_year_id', store=True, index=True)
    class_id = fields.Many2one(
        'school.class', required=True, ondelete='restrict', index=True, tracking=True)
    section_id = fields.Many2one(related='class_id.section_id', store=True)
    shift_id = fields.Many2one('school.shift', ondelete='restrict')
    stream_id = fields.Many2one('school.stream', ondelete='restrict')
    roll_number = fields.Integer(required=True, tracking=True)
    date_start = fields.Date(required=True, tracking=True)
    date_end = fields.Date(tracking=True)
    transfer_reason = fields.Text()
    is_effective = fields.Boolean(compute='_compute_is_effective', search='_search_is_effective')

    _placement_roll_positive = models.Constraint(
        'CHECK(roll_number > 0)',
        'A placement roll number must be positive.',
    )
    _placement_date_order = models.Constraint(
        'CHECK(date_end IS NULL OR date_end >= date_start)',
        'Placement end date cannot be before its start date.',
    )

    @api.depends('date_start', 'date_end')
    def _compute_is_effective(self):
        today = fields.Date.context_today(self)
        for rec in self:
            rec.is_effective = rec.date_start <= today and (not rec.date_end or rec.date_end >= today)

    def _search_is_effective(self, operator, value):
        if operator not in ('=', '!='):
            raise ValidationError('Active placement only supports equality searches.')
        today = fields.Date.context_today(self)
        active_domain = [('date_start', '<=', today), '|', ('date_end', '=', False),
                         ('date_end', '>=', today)]
        is_active = (operator == '=' and value) or (operator == '!=' and not value)
        return active_domain if is_active else ['!', *active_domain]

    @api.constrains('enrollment_id', 'class_id', 'date_start', 'date_end', 'roll_number')
    def _check_effective_placement(self):
        for rec in self:
            if rec.class_id.academic_year_id != rec.enrollment_id.academic_year_id:
                raise ValidationError('The placement class must belong to the enrollment year.')
            if rec.date_start < rec.enrollment_id.enrollment_date:
                raise ValidationError('A placement cannot predate its enrollment.')
            if rec.enrollment_id.end_date and (
                    not rec.date_end or rec.date_end > rec.enrollment_id.end_date):
                raise ValidationError('A placement cannot extend beyond its enrollment.')
            overlap = self.search([
                ('id', '!=', rec.id), ('enrollment_id', '=', rec.enrollment_id.id),
                ('date_start', '<=', rec.date_end or fields.Date.to_date('9999-12-31')),
                '|', ('date_end', '=', False), ('date_end', '>=', rec.date_start),
            ], limit=1)
            if overlap:
                override = rec.enrollment_id.override_ids.filtered(
                    lambda item: item.active and item.operation == 'placement')
                if not override:
                    raise ValidationError('Enrollment placements cannot overlap.')
            roll_clash = self.search([
                ('id', '!=', rec.id), ('class_id', '=', rec.class_id.id),
                ('roll_number', '=', rec.roll_number),
                ('date_start', '<=', rec.date_end or fields.Date.to_date('9999-12-31')),
                '|', ('date_end', '=', False), ('date_end', '>=', rec.date_start),
            ], limit=1)
            if roll_clash:
                override = rec.enrollment_id.override_ids.filtered(
                    lambda item: item.active and item.operation == 'roll_number')
                if not override:
                    raise ValidationError('That roll number is already used during this period.')

    def placement_on(self, date):
        return self.filtered(
            lambda p: p.date_start <= date and (not p.date_end or p.date_end >= date))[:1]

    def unlink(self):
        raise ValidationError('Placement history cannot be deleted. Correct it with effective dates.')


class SchoolEnrollmentOverride(models.Model):
    _name = 'school.enrollment.override'
    _description = 'Authorized Enrollment Override'
    _inherit = ['mail.thread']
    _order = 'create_date desc'

    enrollment_id = fields.Many2one(
        'school.enrollment', required=True, ondelete='restrict', index=True)
    operation = fields.Selection([
        ('capacity', 'Capacity'), ('roll_number', 'Roll Number'),
        ('placement', 'Placement Date'),
    ], required=True)
    reason = fields.Text(required=True)
    approved_by_id = fields.Many2one(
        'res.users', required=True, readonly=True, default=lambda self: self.env.user)
    approved_at = fields.Datetime(required=True, readonly=True, default=fields.Datetime.now)
    active = fields.Boolean(default=True)

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su and not self.env.user.has_group(
                'school_management.group_school_director'):
            raise AccessError('Only a Principal or School Administrator can approve overrides.')
        if not self.env.company.school_capacity_override:
            raise ValidationError('Enrollment overrides are disabled in School Settings.')
        return super().create(vals_list)

    def unlink(self):
        raise ValidationError('Override approvals are audit records and cannot be deleted.')


class SchoolPromotionWizard(models.TransientModel):
    _name = 'school.promotion.wizard'
    _description = 'Promote Student'

    enrollment_id = fields.Many2one(
        'school.enrollment', required=True, domain=[('state', '=', 'active')])
    next_class_id = fields.Many2one('school.class', required=True, ondelete='restrict')
    effective_date = fields.Date(required=True, default=lambda self: fields.Date.context_today(self))

    def action_confirm(self):
        self.ensure_one()
        old = self.enrollment_id
        if self.next_class_id.academic_year_id == old.academic_year_id:
            raise ValidationError('Promotion must create an enrollment in the next academic year.')
        old.action_complete()
        new = self.env['school.enrollment'].create({
            'student_id': old.student_id.id,
            'class_id': self.next_class_id.id,
            'enrollment_date': self.effective_date,
            'admission_type': 'returning',
        })
        new.action_activate()
        return {
            'type': 'ir.actions.act_window', 'res_model': 'school.enrollment',
            'view_mode': 'form', 'res_id': new.id,
        }
