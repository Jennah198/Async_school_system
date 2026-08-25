import re

from odoo import api, fields, models  # type: ignore
from odoo.exceptions import AccessError, ValidationError  # type: ignore
from dateutil.relativedelta import relativedelta
from ethiopian_date import EthiopianDateConverter


class SchoolAcademicYear(models.Model):
    _name = 'school.academic.year'
    _description = 'Academic Year'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name desc'

    name = fields.Char(string='Academic Year', required=True, help="For example 2018.")
    date_start = fields.Date(string='Starts On', required=True)
    date_end = fields.Date(string='Ends On', required=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('archived', 'Archived'),
    ], string='Status', default='draft', required=True, tracking=True)
    is_current = fields.Boolean(
        string='Current',
        help='The year offered by default on new classes. Only one year holds it.',
    )
    class_ids = fields.One2many('school.class', 'academic_year_id', string='Classes')
    class_count = fields.Integer(string='Class Count', compute='_compute_class_count')
    active = fields.Boolean(string='Active', default=True)

    _name_unique = models.Constraint(
        'unique(name)',
        'That academic year already exists.',
    )
    _date_order = models.Constraint(
        'CHECK(date_end IS NULL OR date_start IS NULL OR date_end > date_start)',
        'The end date must be after the start date.',
    )

    @api.depends('class_ids')
    def _compute_class_count(self):
        counts = dict(self.env['school.class']._read_group(
            [('academic_year_id', 'in', self.ids)], ['academic_year_id'], ['__count'],
        ))
        for rec in self:
            rec.class_count = counts.get(rec, 0)

    @api.constrains('is_current')
    def _check_single_current_year(self):
        for rec in self.filtered('is_current'):
            clash = self.search(
                [('is_current', '=', True), ('id', '!=', rec.id)], limit=1,
            )
            if clash:
                raise ValidationError(
                    '%s is already the current academic year. Clear it there first.' % clash.name
                )

    @api.constrains('name', 'date_start')
    def _check_name_matches_start_year(self):
        # Name is a single Ethiopian year (e.g. "2018"). It must match the
        # Ethiopian-calendar year of the Gregorian date_start actually stored,
        # since Odoo/Postgres only store Gregorian dates internally.
        for rec in self.filtered(lambda r: r.name and r.date_start):
            if not re.match(r'^\d{4}$', rec.name):
                raise ValidationError(
                    "Academic year name must be a 4-digit Ethiopian year, "
                    "for example 2018."
                )
            ethiopian_date = EthiopianDateConverter.date_to_ethiopian(rec.date_start)
            if int(rec.name) != ethiopian_date.year:
                raise ValidationError(
                    "The name (%s) doesn't match the Ethiopian year for the start "
                    "date you entered (%s), which is %s in the Ethiopian calendar."
                    % (rec.name, rec.date_start, ethiopian_date.year)
                )

    @api.model
    def _default_year(self):
        """The year new classes start on: whichever is flagged current, else the
        newest on record. Returns an empty recordset when none exist yet."""
        return self.search([('is_current', '=', True)], limit=1) or self.search([], limit=1)

    def write(self, vals):
        protected = set(vals) - {'state', 'is_current', 'active'}
        if protected and any(year.state in ('closed', 'archived') for year in self):
            authorized = (
                self.env.context.get('authorized_academic_correction')
                and (self.env.su or self.env.user.has_group(
                    'school_management.group_school_director'))
            )
            if not authorized:
                raise ValidationError(
                    'Closed academic years are read-only. Use an authorized correction workflow.')
        if vals.get('state') in ('closed', 'archived'):
            vals.setdefault('is_current', False)
        return super().write(vals)

    def action_open(self):
        """A year is recorded in Draft and only becomes usable here, which is why
        the date rule belongs on this transition and not on create(): a school has
        to be able to record the year it is currently in — which by definition
        started in the past — and the historical years its reports and migrations
        refer to. What must not happen is a finished year being opened for
        enrolment and attendance, and that is what is checked below.

        Opening a year always makes it Current, even if an earlier year is
        still Open and running its own attendance/marks. Current means
        "where new registrations default to," not "which year is actively
        in session" — those are tracked independently via each year's state.
        """
        today = fields.Date.today()
        for year in self:
            if year.state != 'draft':
                raise ValidationError('Only a draft academic year can be opened.')
            if year.date_end and year.date_end < today:
                et_end = EthiopianDateConverter.date_to_ethiopian(year.date_end)
                raise ValidationError(
                    '%s ended on %s (%s in the Ethiopian calendar) and cannot be opened. '
                    'Only the current or a future academic year can be opened.'
                    % (year.name, year.date_end, et_end.year)
                )
            other_current = self.search([
                ('is_current', '=', True), ('id', '!=', year.id),
            ])
            if other_current:
                other_current.write({'is_current': False})
            year.write({'state': 'open', 'is_current': True})

    def action_close(self):
        for year in self:
            if year.state != 'open':
                raise ValidationError('Only an open academic year can be closed.')
            year.write({'state': 'closed'})

    def action_archive_year(self):
        for year in self:
            if year.state != 'closed':
                raise ValidationError('Only a closed academic year can be archived.')
            year.write({'state': 'archived', 'active': False})

    def action_view_classes(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Classes',
            'res_model': 'school.class',
            'view_mode': 'list,form',
            'domain': [('academic_year_id', '=', self.id)],
            'context': {'default_academic_year_id': self.id},
        }

    def action_create_next_year(self):
        """Generate the following academic year from this one: name + 1,
        both dates shifted forward exactly one year. Goes through create(),
        so every existing validation (future-date, Ethiopian name match,
        unique name) still applies automatically.
        """
        self.ensure_one()
        next_name = str(int(self.name) + 1)
        next_date_start = self.date_start + relativedelta(years=1)
        next_date_end = self.date_end + relativedelta(years=1)

        existing = self.search([('name', '=', next_name)], limit=1)
        if existing:
            raise ValidationError(
                "%s already exists. Open it directly instead of creating it again."
                % next_name
            )

        new_year = self.create({
            'name': next_name,
            'date_start': next_date_start,
            'date_end': next_date_end,
        })
        return {
            'type': 'ir.actions.act_window',
            'name': 'Academic Year',
            'res_model': 'school.academic.year',
            'view_mode': 'form',
            'res_id': new_year.id,
            'target': 'current',
        }


class SchoolAcademicYearCorrection(models.TransientModel):
    _name = 'school.academic.year.correction'
    _description = 'Authorized Academic Year Correction'

    academic_year_id = fields.Many2one(
        'school.academic.year', required=True,
        domain=[('state', 'in', ('closed', 'archived'))])
    name = fields.Char(required=True)
    date_start = fields.Date(required=True)
    date_end = fields.Date(required=True)
    reason = fields.Text(required=True)

    def action_confirm(self):
        self.ensure_one()
        if not self.env.su and not self.env.user.has_group(
                'school_management.group_school_director'):
            raise AccessError('Only a Principal or School Administrator can correct closed years.')
        self.academic_year_id.with_context(authorized_academic_correction=True).write({
            'name': self.name, 'date_start': self.date_start, 'date_end': self.date_end,
        })
        self.academic_year_id.message_post(
            body='Authorized correction: %s' % self.reason)