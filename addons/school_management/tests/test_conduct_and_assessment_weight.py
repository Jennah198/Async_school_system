import base64
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

DUMMY_FILE = base64.b64encode(b'dummy file content')


class TestConductAndAssessmentWeight(TransactionCase):

    def setUp(self):
        super().setUp()

        self.year = self.env['school.academic.year'].search([('name', '=', '2018')], limit=1)
        if not self.year:
            self.year = self.env['school.academic.year'].create({
                'name': '2018',
                'date_start': '2025-09-11',
                'date_end': '2026-06-30',
            })

        self.term = self.env['school.term'].search([('academic_year_id', '=', self.year.id)], limit=1)
        if not self.term:
            self.term = self.env['school.term'].create({
                'name': 'Term 1 Weight Conduct Unique',
                'academic_year_id': self.year.id,
                'date_start': self.year.date_start,
                'date_end': self.year.date_end,
            })

        self.school_class = self.env['school.class'].create({
            'name': 'Grade 9B Weight Conduct Unique',
            'academic_year_id': self.year.id,
            'is_entry_level': True,
        })

        self.subject_bio = self.env['school.subject'].create({
            'name': 'Biology Conduct Unique',
        })

        self.env['school.grade.subject'].create({
            'class_id': self.school_class.id,
            'subject_id': self.subject_bio.id,
        })

        # Grading Scheme
        self.scheme = self.env['school.grading.scheme'].search([], limit=1)
        if not self.scheme:
            self.scheme = self.env['school.grading.scheme'].create({
                'name': 'Standard Scheme Conduct Unique',
                'pass_percentage': 50.0,
            })

        # Staff & Teacher Setup
        job_title = self.env['school.job.title'].search([('department', '=', 'academic')], limit=1)
        if not job_title:
            job_title = self.env['school.job.title'].create({
                'name': 'Academic Teacher Unique CW',
                'department': 'academic',
            })

        staff = self.env['school.staff'].create({
            'first_name': 'Birhanu',
            'last_name': 'Nega',
            'department': 'academic',
            'job_title_id': job_title.id,
            'employment_status': 'active',
            'phone': '+251911888877',
            'email': 'birhanu_wc_uniq@school.example',
            'date_of_birth': '1982-03-20',
        })
        self.env['school.staff.responsibility'].create({
            'staff_id': staff.id,
            'responsibility': 'teacher',
            'is_primary': True,
            'start_date': self.term.date_start,
            'department': 'academic',
        })
        staff.action_activate()
        self.teacher = self.env['school.teacher'].create({'staff_id': staff.id})

        # Teacher Assignment
        self.assignment = self.env['school.teacher.assignment'].create({
            'teacher_id': self.teacher.id,
            'class_id': self.school_class.id,
            'subject_id': self.subject_bio.id,
            'term_id': self.term.id,
        })

    def test_assessment_total_weight_cannot_exceed_100(self):
        """Creating assessments summing over 100% weight in the same term and subject raises ValidationError."""
        self.env['school.assessment'].create({
            'name': 'Continuous Assessment 1',
            'class_id': self.school_class.id,
            'subject_id': self.subject_bio.id,
            'term_id': self.term.id,
            'teacher_assignment_id': self.assignment.id,
            'date': self.term.date_start,
            'max_mark': 40.0,
            'weight': 40.0,
        })

        self.env['school.assessment'].create({
            'name': 'Midterm Assessment',
            'class_id': self.school_class.id,
            'subject_id': self.subject_bio.id,
            'term_id': self.term.id,
            'teacher_assignment_id': self.assignment.id,
            'date': self.term.date_start,
            'max_mark': 30.0,
            'weight': 30.0,
        })

        # Total is 70%. Adding 40% exceeds 100% and must fail
        with self.assertRaises(ValidationError):
            self.env['school.assessment'].create({
                'name': 'Final Exam Overweight',
                'class_id': self.school_class.id,
                'subject_id': self.subject_bio.id,
                'term_id': self.term.id,
                'teacher_assignment_id': self.assignment.id,
                'date': self.term.date_start,
                'max_mark': 40.0,
                'weight': 40.0,
            })

    def test_adjusting_assessment_weight_frees_capacity(self):
        """Updating assessment weight frees up capacity for subsequent assessments."""
        a1 = self.env['school.assessment'].create({
            'name': 'Continuous Assessment A',
            'class_id': self.school_class.id,
            'subject_id': self.subject_bio.id,
            'term_id': self.term.id,
            'teacher_assignment_id': self.assignment.id,
            'date': self.term.date_start,
            'max_mark': 60.0,
            'weight': 60.0,
        })

        self.env['school.assessment'].create({
            'name': 'Continuous Assessment B',
            'class_id': self.school_class.id,
            'subject_id': self.subject_bio.id,
            'term_id': self.term.id,
            'teacher_assignment_id': self.assignment.id,
            'date': self.term.date_start,
            'max_mark': 40.0,
            'weight': 40.0,
        })

        # Reduce weight of a1 from 60 to 10
        a1.write({'weight': 10.0})

        # Now creating a 50% assessment is valid (10% + 40% + 50% = 100% <= 100%)
        a3 = self.env['school.assessment'].create({
            'name': 'Final Exam Replacement',
            'class_id': self.school_class.id,
            'subject_id': self.subject_bio.id,
            'term_id': self.term.id,
            'teacher_assignment_id': self.assignment.id,
            'date': self.term.date_start,
            'max_mark': 50.0,
            'weight': 50.0,
        })
        self.assertTrue(bool(a3))

    def test_report_card_conduct_and_remarks_storage_and_lifecycle(self):
        """Report card saves conduct grade, homeroom remarks, and director remarks properly."""
        student = self.env['school.student'].create({
            'name': 'Student Conduct Unique',
            'academic_year_id': self.year.id,
            'class_id': self.school_class.id,
            'date_of_birth': '2010-05-15',
            'fan_number': '1000000000000099',
            'guardian_name': 'Guardian Student Conduct',
            'guardian_phone': '+251911000099',
            'emergency_contact_name': 'Emergency Student Conduct',
            'emergency_contact_phone': '+251911000098',
            'birth_certificate': DUMMY_FILE,
            'registration_date': self.term.date_start,
            'registration_status': 'approved',
        })
        student._ensure_enrollment()
        enrollment = student.enrollment_ids[:1]

        card = self.env['school.report.card'].create({
            'student_id': student.id,
            'enrollment_id': enrollment.id,
            'academic_year_id': self.year.id,
            'term_id': self.term.id,
            'class_id': self.school_class.id,
            'grading_scheme_id': self.scheme.id,
            'overall_average': 88.5,
            'result': 'pass',
            'state': 'draft',
            'conduct': 'A',
            'homeroom_remarks': 'Demonstrates outstanding academic focus and discipline.',
            'principal_remarks': 'Promoted with honors.',
            'result_snapshot': [{'subject_id': self.subject_bio.id, 'percentage': 88.5}],
        })

        self.assertEqual(card.conduct, 'A')
        self.assertEqual(card.homeroom_remarks, 'Demonstrates outstanding academic focus and discipline.')
        self.assertEqual(card.principal_remarks, 'Promoted with honors.')

        card.write({'conduct': 'B', 'homeroom_remarks': 'Very good progress throughout the term.'})
        self.assertEqual(card.conduct, 'B')
        self.assertEqual(card.homeroom_remarks, 'Very good progress throughout the term.')