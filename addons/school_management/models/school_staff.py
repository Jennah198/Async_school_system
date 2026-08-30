import re

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools import email_normalize

# '_' and '%' are legal in the local part of an address but are wildcards to
# =ilike, so they are escaped before any address is used as a search pattern.
LIKE_WILDCARDS = re.compile(r'([\\%_])')

NON_DIGITS = re.compile(r'\D')
# Length of the national significant number, the part that identifies the
# subscriber once a country code or a trunk '0' is taken off.
PHONE_KEY_DIGITS = 9

# A Fayda number is exactly sixteen digits. [0-9] rather than \d on purpose:
# \d also matches non-ASCII digits, which are not a valid national identifier.
FAYDA_ID_DIGITS = 16
FAYDA_ID_PATTERN = re.compile(r'[0-9]{%d}' % FAYDA_ID_DIGITS)

MINIMUM_STAFF_AGE = 18
# Date of birth is personal data, so it stays restricted — but the roles that
# register staff have to see it, or the age rule guards a field they cannot fill.
PERSONAL_DATA_GROUPS = (
    'base.group_system,'
    'school_management.group_school_registrar,'
    'school_management.group_school_hr'
)


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
    active = fields.Boolean(string='Active', default=True)

    _name_department_unique = models.Constraint(
        'unique(name, department)',
        'This job title already exists for this department.',
    )


class SchoolStaff(models.Model):
    _name = 'school.staff'
    _description = 'Staff Registration'
    _order = 'name'

    staff_id = fields.Char(
        string='Staff ID', copy=False, readonly=True,
    )
    first_name = fields.Char(string='First Name', required=True)
    last_name = fields.Char(string='Last Name', required=True)
    name = fields.Char(
        string='Full Name', compute='_compute_name', store=True, readonly=True,
    )
    photo = fields.Image(string='Photo', max_width=256, max_height=256)
    gender = fields.Selection([
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ], string='Gender')

    @api.depends('first_name', 'last_name')
    def _compute_name(self):
        for rec in self:
            parts = [p for p in [rec.first_name, rec.last_name] if p]
            rec.name = ' '.join(parts) if parts else ''
    date_of_birth = fields.Date(string='Date of Birth', groups=PERSONAL_DATA_GROUPS)
    # Char, never Integer: a leading zero is part of the identifier, the value is
    # 16 digits wide, and no arithmetic is ever done on it. No size= either, so an
    # over-long entry reaches _check_fayda_id and is reported instead of trimmed.
    fayda_id = fields.Char(
        string='Fayda ID', copy=False, groups=PERSONAL_DATA_GROUPS,
        help='Ethiopian Fayda identification number. Exactly 16 digits.',
    )
    age = fields.Integer(
        string='Age', compute='_compute_age', store=True, groups=PERSONAL_DATA_GROUPS,
        help='Age today, from the date of birth.',
    )

    @api.depends('date_of_birth')
    def _compute_age(self):
        today = fields.Date.context_today(self)
        for rec in self:
            rec.age = relativedelta(today, rec.date_of_birth).years if rec.date_of_birth else 0

    phone = fields.Char(string='Phone')
    mobile = fields.Char(string='Mobile')
    email = fields.Char(string='Email')
    address = fields.Text(string='Address', groups='base.group_system')
    emergency_contact_name = fields.Char(string='Emergency Contact', groups='base.group_system')
    emergency_contact_phone = fields.Char(string='Emergency Phone', groups='base.group_system')

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
    job_title_id = fields.Many2one(
        'school.job.title', string='Job Title',
        domain="[('department', '=', department), ('active', '=', True)]",
        ondelete='restrict',
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
    notes = fields.Text(string='Notes', groups='base.group_system')

    active = fields.Boolean(string='Active', default=True)
    user_id = fields.Many2one('res.users', string='Linked User')

    _staff_id_unique = models.Constraint(
        'unique(staff_id)',
        'Staff ID must be unique.',
    )
    # Database-level, and deliberately not filtered to active rows: a Fayda number
    # identifies a person for life, so a rehire must reuse the archived record
    # rather than register the same human being twice. This matches _staff_id_unique
    # and the email rule; the phone rule is active-only because a line is reassigned
    # when someone leaves, which is not true of a national identifier.
    _fayda_id_unique = models.Constraint(
        'unique(fayda_id)',
        'This Fayda ID is already registered to another staff member.',
    )
    _end_date_after_hire = models.Constraint(
        'CHECK(end_date IS NULL OR hire_date IS NULL OR end_date >= hire_date)',
        'End date cannot be before hire date.',
    )

    def init(self):
        self.env.cr.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS school_staff_user_id_active_uniq
            ON school_staff (user_id)
            WHERE active AND user_id IS NOT NULL
        """)

    @api.onchange('department')
    def _onchange_department(self):
        """Clear job title when department changes (old title may not belong to new department)."""
        self.job_title_id = False

    @api.constrains('department', 'job_title_id')
    def _check_job_title_department(self):
        for rec in self:
            if rec.job_title_id and rec.department and rec.job_title_id.department != rec.department:
                raise ValidationError("Job title does not belong to the selected department.")

    @api.model
    def _phone_key(self, phone):
        """Reduce a number to the digits that identify the subscriber, so the way
        it was typed cannot disguise a duplicate: '+251 91 100 0000', '0911000000'
        and '251911000000' are one number and all key to '911000000'.

        Unlike an email address the stored value is left exactly as typed, since
        the spacing a school uses to write its own numbers is worth keeping.
        """
        digits = NON_DIGITS.sub('', phone or '')
        return digits[-PHONE_KEY_DIGITS:] if len(digits) > PHONE_KEY_DIGITS else digits

    @api.constrains('phone')
    def _check_phone(self):
        for rec in self:
            key = rec._phone_key(rec.phone)
            if not key:
                continue
            # Archived staff, unlike their email address, do not keep holding a
            # number: an address stays taken as an Odoo login, whereas a phone
            # line is handed on when someone leaves.
            others = self.sudo().with_context(active_test=True).search([
                ('id', '!=', rec.id),
                ('phone', '!=', False),
            ])
            clash = others.filtered(lambda staff: staff._phone_key(staff.phone) == key)[:1]
            if clash:
                raise ValidationError(
                    '%s is already the phone number of %s (%s). Two staff members '
                    'cannot share a number.' % (
                        rec.phone,
                        clash.name or 'another staff record',
                        clash.staff_id or 'not yet activated',
                    )
                )

    @api.constrains('date_of_birth')
    def _check_date_of_birth(self):
        today = fields.Date.context_today(self)
        for rec in self:
            if rec.date_of_birth:
                if rec.date_of_birth >= today:
                    raise ValidationError("Date of birth must be in the past.")
                if rec.date_of_birth.year < 1900:
                    raise ValidationError("Date of birth cannot be before 1900.")
                age = relativedelta(today, rec.date_of_birth).years
                if age < MINIMUM_STAFF_AGE:
                    raise ValidationError(
                        'A staff member must be at least %s years old. %s is %s.'
                        % (MINIMUM_STAFF_AGE, rec.name or 'This person', age)
                    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('email'):
                vals['email'] = self._normalize_email(vals['email'])
            if 'fayda_id' in vals:
                vals['fayda_id'] = self._normalize_fayda_id(vals['fayda_id'])
        self._assert_fayda_ids_available(
            [vals.get('fayda_id') for vals in vals_list])
        return super().create(vals_list)

    def write(self, vals):
        if vals.get('email'):
            vals = dict(vals, email=self._normalize_email(vals['email']))
        if 'fayda_id' in vals:
            vals = dict(vals, fayda_id=self._normalize_fayda_id(vals['fayda_id']))
            self._assert_fayda_ids_available([vals['fayda_id']], exclude=self)
        return super().write(vals)

    @api.model
    def _assert_fayda_ids_available(self, fayda_ids, exclude=None):
        """Checked before the values reach the database, so a duplicate is
        reported by the name of whoever already holds it. The unique index is
        still the guarantee — it covers a race between two sessions and anything
        written outside the ORM — but on its own it would surface as a raw
        constraint violation naming a table, not a person.
        """
        wanted = [f for f in fayda_ids if f]
        if not wanted:
            return
        seen = set()
        for fayda_id in wanted:
            if fayda_id in seen:
                raise ValidationError(
                    'Fayda ID %s appears twice in the same batch. A Fayda number '
                    'identifies one person, so it cannot be used twice.' % fayda_id
                )
            seen.add(fayda_id)
        domain = [('fayda_id', 'in', wanted)]
        if exclude:
            domain.append(('id', 'not in', exclude.ids))
        # sudo and active_test=False: a Fayda number is unique across every staff
        # record, including archived ones and ones this user cannot see.
        holder = self.sudo().with_context(active_test=False).search(domain, limit=1)
        if holder:
            raise ValidationError(
                'Fayda ID %s is already registered to %s (%s). A Fayda number '
                'identifies one person, so it cannot be used twice.'
                % (holder.fayda_id, holder.name or 'another staff record',
                   holder.staff_id or 'not yet activated')
            )

    @api.model
    def _normalize_fayda_id(self, fayda_id):
        """Surrounding whitespace, which a copy-paste carries in, is dropped.
        Nothing else is touched: an inner space or a separator is left exactly as
        typed so _check_fayda_id can reject the value and name it back to the user.
        Silently stripping those would turn a mistyped national identifier into a
        plausible-looking one belonging to somebody else.

        A blank entry is stored as NULL rather than '', so that staff without a
        Fayda number do not collide with each other under the unique index.
        """
        return (fayda_id or '').strip() or False

    @api.constrains('fayda_id')
    def _check_fayda_id(self):
        for rec in self:
            if not rec.fayda_id:
                continue
            if not FAYDA_ID_PATTERN.fullmatch(rec.fayda_id):
                raise ValidationError(
                    'Fayda ID must be exactly %s digits with nothing else in it — '
                    'no letters, spaces or separators. "%s" has %s character(s).'
                    % (FAYDA_ID_DIGITS, rec.fayda_id, len(rec.fayda_id))
                )

    @api.model
    def _normalize_email(self, email):
        """Store one canonical form of the address. A teacher profile turns this
        address into an Odoo login, so 'Almaz <Almaz@S.com> ' and 'almaz@s.com'
        must not be able to reach the database as two different values.

        An unusable address is stored as typed and left to _check_email, which
        reports it better than a silent rewrite would.
        """
        return email_normalize(email) or email

    @api.constrains('email')
    def _check_email(self):
        for rec in self:
            if not rec.email:
                continue
            normalized = email_normalize(rec.email)
            if not normalized:
                raise ValidationError("Please enter a valid email address.")
            # sudo: the address becomes a login, and logins are unique across the
            # whole database, so a duplicate the current user cannot see is still
            # a duplicate. Archived staff keep their address for the same reason.
            duplicate = self.sudo().with_context(active_test=False).search([
                ('id', '!=', rec.id),
                ('email', '=ilike', LIKE_WILDCARDS.sub(r'\\\1', normalized)),
            ], limit=1)
            if duplicate:
                raise ValidationError(
                    '%s is already the email address of %s (%s). Staff email '
                    'addresses must be unique because a teacher profile turns '
                    'this address into their Odoo login.' % (
                        normalized,
                        duplicate.name or 'another staff record',
                        duplicate.staff_id or 'not yet activated',
                    )
                )
