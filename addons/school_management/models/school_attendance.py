from odoo import fields, models, api


class SchoolAttendance(models.Model):
    _name = "school.attendance"
    _description = "Daily Attendance Sheet"
    _order = "date desc"


    date = fields.Date(
        string="Date",
        required=True,
        default=fields.Date.context_today
    )


    class_id = fields.Many2one(
        "school.class",
        string="Class",
        required=True
    )


    subject_id = fields.Many2one(
        "school.subject",
        string="Subject",
        required=True
    )


    teacher_id = fields.Many2one(
        "school.teacher",
        string="Teacher",
        required=True
    )

    attendance_line_ids = fields.One2many(
        "school.attendance.line",
        "attendance_id",
        string="Students"
    )


    @api.onchange('class_id')
    def _onchange_class_id(self):

        if self.class_id:

            self.attendance_line_ids = [(5,0,0)]

            lines = []

            for student in self.class_id.student_ids:
                lines.append(
                    (0,0,{
                        "student_id": student.id,
                        "status": "present"
                    })
                )

            self.attendance_line_ids = lines