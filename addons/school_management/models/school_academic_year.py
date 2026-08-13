from odoo import api, fields, models # type: ignore
from odoo.exceptions import ValidationError # type: ignore


class SchoolAcademicYear(models.Model):
    _name = 'school.academic.year'
    _description = 'Academic Year'
    _inherit=['mail.thread','mail.activity.mixin']
    # Newest first: the year people are working in is the one they want at the top.
    _order = 'name desc'

    name = fields.Char(
        string='Academic Year',
          required=True, 
          help="For example 2026/2027.")
    date_start = fields.Date(string='Starts On',required=True)
    date_end = fields.Date(string='Ends On',required=True)
    # Status of the academic year, per SRS Section 4.1
    # draft = not yet in use, open = active for enrollment/attendance,
    # closed = finished but still readable, archived = fully locked/historical
    state=fields.Selection([
        ('draft','Draft'),
        ('open','Open'),
        ('closed','Closed'),
        ('archived','Archived'),
    ],string='Status',default='draft',required=True,tracking=True )
    is_current = fields.Boolean(
        string='Current',
        help='The year offered by default on new classes. Only one year holds it.',
    )
    class_ids = fields.One2many('school.class', 'academic_year_id', string='Classes')
    class_count = fields.Integer(string='Classes', compute='_compute_class_count')
    active = fields.Boolean(string='Active', default=True)

    _sql_constraints = [
        ('name_unique', 'unique(name)', 'That academic year already exists.'),
        ('date_order', 'CHECK(date_end IS NULL OR date_start IS NULL OR date_end > date_start)',
         'The end date must be after the start date.'),
    ]

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
    def action_open(self):
        self.write({'state': 'open'})

    def action_close(self):
        self.write({'state': 'closed'})

    def action_archive_year(self):
        self.write({'state': 'archived', 'active': False})
    @api.model
    def _default_year(self):
        """The year new classes start on: whichever is flagged current, else the
        newest on record. Returns an empty recordset when none exist yet."""
        return self.search([('is_current', '=', True)], limit=1) or self.search([], limit=1)

    def action_view_classes(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Classes',
            'res_model': 'school.class',
            'view_mode': 'tree,form',
            'domain': [('academic_year_id', '=', self.id)],
            'context': {'default_academic_year_id': self.id},
        }
