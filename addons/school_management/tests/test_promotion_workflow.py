import base64
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase

DUMMY_FILE = base64.b64encode(b'dummy file content')


class TestPromotionWorkflow(TransactionCase):
    def setUp(self):
        super().setUp()

        self.year_2018 = self.env['school.academic.year'].search([('name', '=', '2018')], limit=1)
        if not self.year_2018:
            self.year_2018 = self.env['school.academic.year'].create({
                'name': '2018',
                'date_start': '2025-09-11',
                'date_end': '2026-06-30',
            })

        self.year_2019 = self.env['school.academic.year'].search([('name', '=', '2019')], limit=1)
        if not self.year_2019:
            self.year_2019 = self.env['school.academic.year'].create({
                'name': '2019',
                'date_start': '2026-09-11',
                'date_end': '2027-06-30',
            })

        self.term_1 = self.env['school.term'].search([
            ('academic_year_id', '=', self.year_2018.id)
        ], limit=1)
        if not self.term_1:
            self.term_1 = self.env['school.term'].create({
                'name': 'Term 1 Promo Unique',
                'academic_year_id': self.year_2018.id,
                'date_start': '2025-09-11',
                'date_end': '2026-01-30',
            })

        self.grade_7 = self.env['school.grade'].search([('level', '=', '7')], limit=1)
        if not self.grade_7:
            self.grade_7 = self.env['school.grade'].create({
                'name': 'Grade 7',
                'code': 'G7',
                'level': '7',
                'sequence': 7,
            })

        self.grade_8 = self.env['school.grade'].search([('level', '=', '8')], limit=1)
        if not self.grade_8:
            self.grade_8 = self.env['school.grade'].create({
                'name': 'Grade 8',
                'code': 'G8',
                'level': '8',
                'sequence': 8,
            })

        self.grade_12 = self.env['school.grade'].search([('level', '=', '12')], limit=1)
        if not self.grade_12:
            self.grade_12 = self.env['school.grade'].create({
                'name': 'Grade 12',
                'code': 'G12',
                'level': '12',
                'sequence': 12,
            })

        self.stream_natural = self.env['school.stream'].search([], limit=1)
        if not self.stream_natural:
            self.stream_natural = self.env['school.stream'].create({'name': 'Natural Science'})

        self.section_a = self.env['school.section'].search([('name', '=', 'A')], limit=1)
        if not self.section_a:
            self.section_a = self.env['school.section'].create({'name': 'A'})

        self.grading_scheme = self.env['school.grading.scheme'].search([], limit=1)
        if not self.grading_scheme:
            self.grading_scheme = self.env['school.grading.scheme'].create({
                'name': 'Default Standard Scheme Promo',
            })

        self.class_7a = self.env['school.class'].create({
            'name': 'Grade 7A Promo Unique',
            'grade_id': self.grade_7.id,
            'academic_year_id': self.year_2018.id,
            'section_id': self.section_a.id,
            'is_entry_level': True,
        })
        self.class_8a = self.env['school.class'].create({
            'name': 'Grade 8A Promo Unique',
            'grade_id': self.grade_8.id,
            'academic_year_id': self.year_2019.id,
            'section_id': self.section_a.id,
            'is_entry_level': False,
        })
        self.class_7a_next = self.env['school.class'].create({
            'name': 'Grade 7A Next Year Unique',
            'grade_id': self.grade_7.id,
            'academic_year_id': self.year_2019.id,
            'section_id': self.section_a.id,
            'is_entry_level': False,
        })
        self.class_12a = self.env['school.class'].create({
            'name': 'Grade 12A Promo Unique',
            'grade_id': self.grade_12.id,
            'academic_year_id': self.year_2018.id,
            'section_id': self.section_a.id,
            'is_entry_level': False,
        })

        self.subject_math = self.env['school.subject'].create({'name': 'Math Promo Unique'})
        self.env['school.grade.subject'].create([
            {'class_id': self.class_7a.id, 'subject_id': self.subject_math.id},
            {'class_id': self.class_12a.id, 'subject_id': self.subject_math.id},
        ])

        # Users
        group_user = self.env.ref('base.group_user')
        group_registrar = self.env.ref('school_management.group_school_registrar')
        self.registrar = self.env['res.users'].create({
            'name': 'Registrar Promo Unique',
            'login': 'registrar_promo_uniq',
            'email': 'reg_promo_uniq@school.example',
            'group_ids': [(6, 0, [group_user.id, group_registrar.id])],
        })

        # Students
        self.student_pass = self._create_student('Abel Pass Promo', '1000000000000011', self.class_7a)
        self.student_fail = self._create_student('Nahom Fail Promo', '1000000000000012', self.class_7a)
        self.student_grad = self._create_student('Senior Grad Promo', '1000000000000013', self.class_12a, stream_id=self.stream_natural.id)

    def _create_student(self, name, fan_number, school_class, stream_id=False):
        vals = {
            'name': name,
            'academic_year_id': school_class.academic_year_id.id,
            'class_id': school_class.id,
            'date_of_birth': '2008-05-15',
            'fan_number': fan_number,
            'guardian_name': 'Guardian ' + name,
            'guardian_phone': '+251911888801',
            'emergency_contact_name': 'Emergency Contact ' + name,
            'emergency_contact_phone': '+251911888802',
            'birth_certificate': DUMMY_FILE,
            'previous_grade_document': DUMMY_FILE,
            'registration_date': school_class.academic_year_id.date_start,
            'registration_status': 'approved',
        }
        if stream_id:
            vals['stream_id'] = stream_id
        student = self.env['school.student'].create(vals)
        student._ensure_enrollment()
        return student

    def test_promotion_calculation_and_execution_lifecycle(self):
        enr_pass = self.student_pass.enrollment_ids.filtered(lambda e: e.academic_year_id == self.year_2018)[:1]
        enr_fail = self.student_fail.enrollment_ids.filtered(lambda e: e.academic_year_id == self.year_2018)[:1]

        self.env['school.report.card'].create({
            'student_id': self.student_pass.id,
            'enrollment_id': enr_pass.id,
            'academic_year_id': self.year_2018.id,
            'term_id': self.term_1.id,
            'class_id': self.class_7a.id,
            'grading_scheme_id': self.grading_scheme.id,
            'overall_average': 80.0,
            'result': 'pass',
            'state': 'published',
            'result_snapshot': [{'subject_id': self.subject_math.id, 'percentage': 80.0}],
        })

        self.env['school.report.card'].create({
            'student_id': self.student_fail.id,
            'enrollment_id': enr_fail.id,
            'academic_year_id': self.year_2018.id,
            'term_id': self.term_1.id,
            'class_id': self.class_7a.id,
            'grading_scheme_id': self.grading_scheme.id,
            'overall_average': 40.0,
            'result': 'fail',
            'state': 'published',
            'result_snapshot': [{'subject_id': self.subject_math.id, 'percentage': 40.0}],
        })

        batch = self.env['school.promotion.batch'].with_user(self.registrar).create({
            'academic_year_id': self.year_2018.id,
            'target_academic_year_id': self.year_2019.id,
            'grade_id': self.grade_7.id,
            'class_ids': [(6, 0, [self.class_7a.id])],
            'minimum_pass_average': 50.0,
        })

        batch.action_calculate_outcomes()
        self.assertEqual(batch.state, 'calculated')
        self.assertEqual(len(batch.line_ids), 2)

        line_pass = batch.line_ids.filtered(lambda l: l.student_id == self.student_pass)
        line_fail = batch.line_ids.filtered(lambda l: l.student_id == self.student_fail)

        self.assertEqual(line_pass.calculated_outcome, 'promoted')
        self.assertEqual(line_pass.target_grade_id, self.grade_8)
        self.assertEqual(line_pass.target_class_id, self.class_8a)

        self.assertEqual(line_fail.calculated_outcome, 'retained')
        self.assertEqual(line_fail.target_grade_id, self.grade_7)
        self.assertEqual(line_fail.target_class_id, self.class_7a_next)

        batch.action_approve()
        self.assertEqual(batch.state, 'approved')

        batch.action_apply_promotion()
        self.assertEqual(batch.state, 'done')

        old_enr_pass = self.env['school.enrollment'].search([
            ('student_id', '=', self.student_pass.id),
            ('academic_year_id', '=', self.year_2018.id),
        ])
        self.assertEqual(old_enr_pass.state, 'completed')

        new_enr_pass = self.env['school.enrollment'].search([
            ('student_id', '=', self.student_pass.id),
            ('academic_year_id', '=', self.year_2019.id),
        ])
        self.assertTrue(bool(new_enr_pass))
        self.assertEqual(new_enr_pass.class_id, self.class_8a)
        self.assertEqual(self.student_pass.class_id, self.class_8a)

    def test_grade_12_terminal_graduation(self):
        enr_grad = self.student_grad.enrollment_ids.filtered(lambda e: e.academic_year_id == self.year_2018)[:1]

        self.env['school.report.card'].create({
            'student_id': self.student_grad.id,
            'enrollment_id': enr_grad.id,
            'academic_year_id': self.year_2018.id,
            'term_id': self.term_1.id,
            'class_id': self.class_12a.id,
            'grading_scheme_id': self.grading_scheme.id,
            'overall_average': 85.0,
            'result': 'pass',
            'state': 'published',
            'result_snapshot': [{'subject_id': self.subject_math.id, 'percentage': 85.0}],
        })

        batch_12 = self.env['school.promotion.batch'].with_user(self.registrar).create({
            'academic_year_id': self.year_2018.id,
            'target_academic_year_id': self.year_2019.id,
            'grade_id': self.grade_12.id,
            'class_ids': [(6, 0, [self.class_12a.id])],
            'minimum_pass_average': 50.0,
        })
        batch_12.action_calculate_outcomes()
        line_grad = batch_12.line_ids.filtered(lambda l: l.student_id == self.student_grad)
        self.assertEqual(line_grad.calculated_outcome, 'graduated')

        batch_12.action_approve()
        batch_12.action_apply_promotion()
        self.assertEqual(batch_12.state, 'done')
        self.assertEqual(self.student_grad.lifecycle_status, 'graduated')