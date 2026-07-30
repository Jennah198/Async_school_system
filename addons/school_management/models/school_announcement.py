from odoo import api, fields, models
from odoo.exceptions import ValidationError

from .school_program import AUDIENCE_TYPES, AUDIENCE_VALUE_FIELDS
from .school_responsibility import DEPARTMENTS, RESPONSIBILITIES


class SchoolAnnouncement(models.Model):
    _name = 'school.announcement'
    _description = 'Targeted Staff Announcement'
    _inherit = ['mail.thread']
    _order = 'priority desc, publish_datetime desc'

    name = fields.Char(string='Title', required=True, tracking=True)
    message = fields.Html(string='Message', required=True)
    category = fields.Selection([
        ('general', 'General'),
        ('academic', 'Academic'),
        ('schedule_change', 'Schedule Change'),
        ('meeting', 'Meeting'),
        ('examination', 'Examination'),
        ('training', 'Training'),
        ('emergency', 'Emergency'),
        ('other', 'Other'),
    ], string='Category', required=True, default='general')

    # Audience codes match school.program so both models share one targeting rule.
    audience_type = fields.Selection(
        AUDIENCE_TYPES, string='Audience', required=True, default='all_staff', tracking=True,
    )

    department = fields.Selection(DEPARTMENTS, string='Department')
    responsibility = fields.Selection(RESPONSIBILITIES, string='Responsibility')
    teacher_ids = fields.Many2many('school.teacher', string='Teachers')
    subject_ids = fields.Many2many('school.subject', string='Subjects')
    class_ids = fields.Many2many('school.class', string='Classes / Sections')
    campus_ids = fields.Many2many('school.campus', string='Branches / Campuses')
    staff_ids = fields.Many2many('school.staff', string='Selected Staff')

    state = fields.Selection([
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ], string='Publication', default='draft', required=True, tracking=True)
    publish_datetime = fields.Datetime(
        string='Publish On', default=lambda self: fields.Datetime.now(), tracking=True,
    )
    expiry_datetime = fields.Datetime(string='Expires On', tracking=True)
    priority = fields.Selection([
        ('0', 'Normal'),
        ('1', 'Important'),
        ('2', 'Urgent'),
    ], string='Priority', default='0', required=True, tracking=True)

    link = fields.Char(string='Link', help='Optional URL for further detail.')
    attachment_ids = fields.Many2many('ir.attachment', string='Attachments')
    author_id = fields.Many2one(
        'res.users', string='Author', default=lambda self: self.env.user, readonly=True,
    )

    # Schedule-change announcements point at what actually changed.
    program_id = fields.Many2one('school.program', string='Related Program')
    class_schedule_id = fields.Many2one('school.class.schedule', string='Related Class Schedule')

    is_live = fields.Boolean(
        string='Live', compute='_compute_is_live', search='_search_is_live',
        help='Published, past its publish time, and not yet expired.',
    )
    active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('expiry_after_publish',
         'CHECK(expiry_datetime IS NULL OR publish_datetime IS NULL OR expiry_datetime > publish_datetime)',
         'The expiry time must be after the publish time.'),
    ]

    @api.depends('state', 'publish_datetime', 'expiry_datetime')
    def _compute_is_live(self):
        now = fields.Datetime.now()
        for rec in self:
            rec.is_live = (
                rec.state == 'published'
                and (not rec.publish_datetime or rec.publish_datetime <= now)
                and (not rec.expiry_datetime or rec.expiry_datetime > now)
            )

    def _search_is_live(self, operator, value):
        now = fields.Datetime.now()
        live = [
            ('state', '=', 'published'),
            '|', ('publish_datetime', '=', False), ('publish_datetime', '<=', now),
            '|', ('expiry_datetime', '=', False), ('expiry_datetime', '>', now),
        ]
        if (operator == '=') == bool(value):
            return live
        return ['!', *live]

    @api.constrains('audience_type', 'department', 'responsibility',
                    'teacher_ids', 'subject_ids', 'class_ids', 'campus_ids', 'staff_ids')
    def _check_audience_values(self):
        for rec in self:
            field = AUDIENCE_VALUE_FIELDS.get(rec.audience_type)
            if field and not rec[field]:
                raise ValidationError(
                    'Select at least one audience value for the chosen audience type.'
                )

    @api.onchange('audience_type')
    def _onchange_audience_type(self):
        """Drop audience values that no longer apply so a stale target is never published."""
        keep = AUDIENCE_VALUE_FIELDS.get(self.audience_type)
        for field in set(AUDIENCE_VALUE_FIELDS.values()) - {keep}:
            self[field] = False

    def action_publish(self):
        for rec in self:
            if not rec.publish_datetime:
                rec.publish_datetime = fields.Datetime.now()
        self.write({'state': 'published'})

    def action_archive_announcement(self):
        self.write({'state': 'archived'})

    def action_reset_draft(self):
        self.write({'state': 'draft'})
