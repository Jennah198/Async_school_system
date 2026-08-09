from odoo import api, fields, models
from odoo.exceptions import ValidationError


class SchoolAttendance(models.Model):
    """Daily class attendance, anchored to the enrollment (SRS §8.2).

    The enrollment is what makes a student attendable: no active enrollment,
    no attendance row (BR-07), and no row outside the enrollment's effective
    dates (BR-09). student_id and class_id are snapshotted from the
    enrollment — the old related class_id followed the student's *current*
    class and silently rewrote history on every class change.
    """
    _name = "school.attendance"
    _description = "Student Attendance"
    _order = "date desc"

    enrollment_id = fields.Many2one(
        "school.enrollment",
        string="Enrollment",
        required=True,
        index=True,
        ondelete="restrict",
        help="Derived from the student's active enrollment when left empty."
    )

    student_id = fields.Many2one(
        "school.student",
        string="Student",
        required=True,
        index=True
    )

    class_id = fields.Many2one(
        "school.class",
        string="Class",
        index=True
    )

    date = fields.Date(
        string="Date",
        required=True,
        default=fields.Date.context_today
    )

    status = fields.Selection(
        [
            ("not_recorded", "Not Recorded"),
            ("present", "Present"),
            ("absent", "Absent"),
            ("late", "Late"),
        ],
        string="Status",
        required=True,
        default="present"
    )

    note = fields.Text(
        string="Remarks"
    )

    _sql_constraints = [
        (
            "student_date_unique",
            "unique(student_id, date)",
            "Attendance already exists for this student on this date."
        )
    ]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._complete_from_enrollment(vals)
        return super().create(vals_list)

    def write(self, vals):
        if 'enrollment_id' in vals or 'student_id' in vals:
            self._complete_from_enrollment(vals)
        return super().write(vals)

    def _complete_from_enrollment(self, vals):
        """The enrollment is the source of truth: fill it from the student's
        active enrollment when absent, then snapshot student and class."""
        Enrollment = self.env['school.enrollment']
        if not vals.get('enrollment_id'):
            student_id = vals.get('student_id') or (len(self) == 1 and self.student_id.id)
            enrollment = Enrollment.search([
                ('student_id', '=', student_id),
                ('state', '=', 'active'),
            ], limit=1)
            if not enrollment:
                student = self.env['school.student'].browse(student_id)
                raise ValidationError(
                    '%s has no active enrollment, so attendance cannot be '
                    'recorded. Enroll the student first.' % (student.name or 'The student')
                )
            vals['enrollment_id'] = enrollment.id
        else:
            enrollment = Enrollment.browse(vals['enrollment_id'])
        vals['student_id'] = enrollment.student_id.id
        vals['class_id'] = enrollment.class_id.id

    @api.constrains('enrollment_id', 'date')
    def _check_date_within_enrollment(self):
        for rec in self:
            if rec.date < rec.enrollment_id.enrollment_date:
                raise ValidationError(
                    'Attendance on %s is before the enrollment of %s started (%s).'
                    % (rec.date, rec.student_id.name, rec.enrollment_id.enrollment_date)
                )
            end = rec.enrollment_id.end_date
            if end and rec.date > end:
                raise ValidationError(
                    'Attendance on %s is after the enrollment of %s ended (%s).'
                    % (rec.date, rec.student_id.name, end)
                )

    def unlink(self):
        if self.env.user.has_group('school_management.group_school_admin'):
            return super().unlink()
        today = fields.Date.context_today(self)
        if any(rec.date != today for rec in self):
            raise ValidationError(
                'Past attendance is history and cannot be deleted. '
                'Ask an administrator for corrections.'
            )
        return super().unlink()


class SchoolAttendanceRoster(models.TransientModel):
    """Take attendance for one class and date: generates the roster from
    active enrollments effective on that date, then opens it for marking."""
    _name = 'school.attendance.roster'
    _description = 'Take Attendance'

    class_id = fields.Many2one('school.class', string='Grade / Class', required=True)
    date = fields.Date(
        string='Date', required=True,
        default=lambda self: fields.Date.context_today(self),
    )

    def action_generate(self):
        self.ensure_one()
        Attendance = self.env['school.attendance']
        enrollments = self.env['school.enrollment'].search([
            ('class_id', '=', self.class_id.id),
            ('state', '=', 'active'),
            ('enrollment_date', '<=', self.date),
            '|', ('end_date', '=', False), ('end_date', '>=', self.date),
        ])
        # Filter on the student, not the enrollment: on a transfer day the
        # student already has a row under the old class.
        recorded_students = Attendance.search([
            ('date', '=', self.date),
            ('student_id', 'in', enrollments.student_id.ids),
        ]).student_id
        Attendance.create([
            {'enrollment_id': enrollment.id, 'date': self.date, 'status': 'not_recorded'}
            for enrollment in enrollments
            if enrollment.student_id not in recorded_students
        ])
        return {
            'type': 'ir.actions.act_window',
            'name': '%s — %s' % (self.class_id.display_name, self.date),
            'res_model': 'school.attendance',
            'view_mode': 'tree',
            'domain': [('class_id', '=', self.class_id.id), ('date', '=', self.date)],
            'context': {'default_date': self.date},
        }
