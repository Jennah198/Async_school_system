from odoo import fields, models # type: ignore


class SchoolAttendanceLine(models.Model):
    _name = "school.attendance.line"
    _description = "Attendance Student Line"


    attendance_id = fields.Many2one(
        "school.attendance",
        required=True,
        ondelete="cascade"
    )


    student_id = fields.Many2one(
        "school.student",
        string="Student",
        required=True
    )


    status = fields.Selection(
        [
            ("present","Present"),
            ("absent","Absent"),
            ("late","Late"),
        ],
        string="Status",
        default="present",
        required=True
    )