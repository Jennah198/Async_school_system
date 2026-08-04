<<<<<<< Updated upstream
from odoo import fields, models  # type: ignore
=======
from odoo import models, fields
>>>>>>> Stashed changes


class SchoolAttendance(models.Model):
    _name = "school.attendance"
    _description = "Student Attendance"
<<<<<<< Updated upstream
    _order = "date desc"
=======
>>>>>>> Stashed changes

    student_id = fields.Many2one(
        "school.student",
        string="Student",
        required=True
    )

<<<<<<< Updated upstream
    class_id = fields.Many2one(
        "school.class",
        string="Class",
        related="student_id.class_id",
        store=True
    )

    date = fields.Date(
        string="Date",
        required=True,
        default=fields.Date.context_today
=======
    date = fields.Date(
        string="Date",
        default=fields.Date.today,
        required=True
>>>>>>> Stashed changes
    )

    status = fields.Selection(
        [
            ("present", "Present"),
            ("absent", "Absent"),
<<<<<<< Updated upstream
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
=======
            ("late", "Late")
        ],
        string="Status",
        default="present",
        required=True
    )

    note = fields.Text(
        string="Notes"
    )
>>>>>>> Stashed changes
