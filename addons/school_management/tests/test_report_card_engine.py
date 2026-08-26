import base64
from odoo.exceptions import ValidationError, AccessError
from odoo.tests.common import TransactionCase

DUMMY_FILE = base64.b64encode(b'dummy file content')


class TestReportCardEngine(TransactionCase):
    def setUp(self):
        super().setUp()
        self.year = self.env['school.academic.year'].create({'name': '2099/2100'})
        self.term = self.env['school.term'].create({
            'name': 'Term 1 Test',
            'academic_year_id': self.year.id,
            'date_start': '2099-09-01',
            'date_end': '2099-12-31',
        })
        self.school_class = self.env['school.class'].create({
            'name': 'Grade 9A',
            'academic_year_id': self.year.id,
            'is_entry_level': True,
        })
        self.subject_math = self.env['school.subject'].create({'name': 'Mathematics'})
        self.subject_eng = self.env['school.subject'].create({'name': 'English'})

        self.env['school.grade.subject'].create([
            {'class_id': self.school_class.id, 'subject_id': self.subject_math.id},
            {'class_id': self.school_class.id, 'subject_id': self.subject_eng.id},
        ])

        # Configure Grading Scheme
        self.scheme = self.env['school.grading.scheme'].create({
            'name': 'Standard Scheme 2099',
            'pass_percentage': 50.0,
            'band_ids': [
                (0, 0, {'name': 'A', 'minimum_percentage': 85.0, 'maximum_percentage': 100.0}),
                (0, 0, {'name': 'B', 'minimum_percentage': 70.0, 'maximum_percentage': 84.99}),
                (0, 0, {'name': 'C', 'minimum_percentage': 50.0, 'maximum_percentage': 69.99}),
                (0, 0, {'name': 'F', 'minimum_percentage': 0.0, 'maximum_percentage': 49.99}),
            ],
        })
        self.scheme.action_use_for_report_cards()

        # Users
        self.officer = self.env['res.users'].create({
            'name': 'Exam Officer Test',
            'login': 'officer_test_eng',
            'email': 'officer_eng@school.example',
            'groups_id': [(6, 0, [
                self.env.ref('base.group_user').id,
                self.env.ref('school_management.group_school_exam_officer').id,
            ])],
        })

        # Staff & Teacher
        job_title = self.env['school.job.title'].create({
            'name': 'Test Teacher Job',
            'department': 'academic',
        })
        staff = self.env['school.staff'].create({
            'first_name': 'Abebe',
            'last_name': 'Bikila',
            'department': 'academic',
            'job_title_id': job_title.id,
            'employment_status': 'active',
            'phone': '+251911999901',
            'email': 'abebe@school.example',
        })
        self.env['school.staff.responsibility'].create({
            'staff_id': staff.id,
            'responsibility': 'teacher',
            'is_primary': True,
            'start_date': '2099-01-01',
            'department': 'academic',
        })
        staff.action_activate()
        self.teacher = self.env['school.teacher'].create({'staff_id': staff.id})

        # Teacher assignments
        self.env['school.teacher.assignment'].create([
            {'teacher_id': self.teacher.id, 'subject_id': self.subject_math.id, 'class_id': self.school_class.id, 'term_id': self.term.id},
            {'teacher_id': self.teacher.id, 'subject_id': self.subject_eng.id, 'class_id': self.school_class.id, 'term_id': self.term.id},
        ])

        # Students
        self.student_1 = self._create_student('Student Alpha')
        self.student_2 = self._create_student('Student Beta')

    def _create_student(self, name):
        student = self.env['school.student'].create({
            'name': name,
            'class_id': self.school_class.id,
            'date_of_birth': '2085-01-01',
            'guardian_name': 'Guardian ' + name,
            'guardian_phone': '+251911000099',
            'birth_certificate': DUMMY_FILE,
            'registration_date': '2099-08-01',
            'registration_status': 'approved',
        })
        student._ensure_enrollment()
        return student

    def _create_and_publish_assessment(self, subject, score_1, score_2, weight=1.0):
        assessment = self.env['school.assessment'].create({
            'name': '%s Quiz' % subject.name,
            'assessment_type': 'quiz',
            'term_id': self.term.id,
            'class_id': self.school_class.id,
            'subject_id': subject.id,
            'teacher_id': self.teacher.id,
            'max_score': 100.0,
            'weight': weight,
            'due_date': '2099-10-15',
        })
        assessment.action_open()
        for mark in assessment.mark_ids:
            if mark.student_id == self.student_1:
                mark.score = score_1
            elif mark.student_id == self.student_2:
                mark.score = score_2
        assessment.action_submit()
        officer_assessment = assessment.with_user(self.officer)
        officer_assessment.action_approve()
        officer_assessment.action_lock()
        officer_assessment.action_publish()
        return assessment

    def test_single_student_report_card_generation_and_snapshot(self):
        self._create_and_publish_assessment(self.subject_math, 90.0, 40.0)
        self._create_and_publish_assessment(self.subject_eng, 80.0, 60.0)

        wizard = self.env['school.report.card.generate'].with_user(self.officer).create({
            'generation_mode': 'student',
            'student_id': self.student_1.id,
            'term_id': self.term.id,
        })
        action = wizard.action_generate()
        card = self.env['school.report.card'].browse(action['res_id'])

        self.assertEqual(card.version, 1)
        self.assertEqual(card.state, 'draft')
        self.assertEqual(card.overall_average, 85.0)
        self.assertEqual(card.result, 'pass')

        # Verify JSON snapshot contains itemized assessment details
        self.assertTrue(bool(card.result_snapshot))
        math_snapshot = next(row for row in card.result_snapshot if row['subject_id'] == self.subject_math.id)
        self.assertEqual(math_snapshot['percentage'], 90.0)
        self.assertEqual(math_snapshot['grade'], 'A')
        self.assertTrue(len(math_snapshot['assessments']) >= 1)
        self.assertEqual(math_snapshot['assessments'][0]['score'], 90.0)

    def test_batch_report_card_generation_by_class(self):
        self._create_and_publish_assessment(self.subject_math, 80.0, 70.0)
        self._create_and_publish_assessment(self.subject_eng, 70.0, 60.0)

        wizard = self.env['school.report.card.generate'].with_user(self.officer).create({
            'generation_mode': 'class',
            'class_id': self.school_class.id,
            'term_id': self.term.id,
        })
        action = wizard.action_generate()
        self.assertEqual(action['res_model'], 'school.report.card')

        cards = self.env['school.report.card'].search([
            ('class_id', '=', self.school_class.id),
            ('term_id', '=', self.term.id),
        ])
        self.assertEqual(len(cards), 2)
        card_1 = cards.filtered(lambda c: c.student_id == self.student_1)
        card_2 = cards.filtered(lambda c: c.student_id == self.student_2)
        self.assertEqual(card_1.overall_average, 75.0)
        self.assertEqual(card_2.overall_average, 65.0)

    def test_versioning_superseded_lifecycle(self):
        self._create_and_publish_assessment(self.subject_math, 50.0, 50.0)
        card_v1 = self.env['school.report.card'].generate_for(self.student_1, self.term)
        self.assertEqual(card_v1.version, 1)

        officer_card = card_v1.with_user(self.officer)
        officer_card.action_approve()
        officer_card.action_publish()
        self.assertEqual(card_v1.state, 'published')

        # Re-generating without correction reason must fail
        wizard = self.env['school.report.card.generate'].with_user(self.officer).create({
            'generation_mode': 'student',
            'student_id': self.student_1.id,
            'term_id': self.term.id,
        })
        with self.assertRaises(ValidationError):
            wizard.action_generate()

        # Re-generating with correction reason succeeds
        wizard.correction_reason = 'Recalculation requested by academic board'
        action = wizard.action_generate()
        card_v2 = self.env['school.report.card'].browse(action['res_id'])
        self.assertEqual(card_v2.version, 2)
        self.assertEqual(card_v2.supersedes_id, card_v1)
        self.assertEqual(card_v2.state, 'draft')

        # When v2 is published, v1 becomes superseded
        officer_card_v2 = card_v2.with_user(self.officer)
        officer_card_v2.action_approve()
        officer_card_v2.action_publish()
        self.assertEqual(card_v2.state, 'published')
        self.assertEqual(card_v1.state, 'superseded')
        self.assertEqual(card_v1.superseded_by_id, card_v2)

    def test_class_and_grade_ranking_with_ties(self):
        # Enable ranking setting
        self.env.company.school_ranking = True

        # Setup grade & two sections
        grade_9 = self.env['school.grade'].create({
            'name': 'Grade 9 Level',
            'code': 'G9_TEST',
            'level': '9',
            'sequence': 9,
        })
        self.school_class.write({'grade_id': grade_9.id, 'name': 'Grade 9A'})
        
        class_9b = self.env['school.class'].create({
            'name': 'Grade 9B',
            'grade_id': grade_9.id,
            'academic_year_id': self.year.id,
            'is_entry_level': True,
        })
        self.env['school.grade.subject'].create([
            {'class_id': class_9b.id, 'subject_id': self.subject_math.id},
        ])
        self.env['school.teacher.assignment'].create([
            {'teacher_id': self.teacher.id, 'subject_id': self.subject_math.id, 'class_id': class_9b.id, 'term_id': self.term.id},
        ])

        # Create students for Class 9B
        student_3 = self.env['school.student'].create({
            'name': 'Student Gamma (9B)',
            'class_id': class_9b.id,
            'date_of_birth': '2085-01-01',
            'guardian_name': 'Guardian Gamma',
            'guardian_phone': '+251911000097',
            'birth_certificate': DUMMY_FILE,
            'registration_date': '2099-08-01',
            'registration_status': 'approved',
        })
        student_3._ensure_enrollment()

        student_4 = self.env['school.student'].create({
            'name': 'Student Delta (9B)',
            'class_id': class_9b.id,
            'date_of_birth': '2085-01-01',
            'guardian_name': 'Guardian Delta',
            'guardian_phone': '+251911000096',
            'birth_certificate': DUMMY_FILE,
            'registration_date': '2099-08-01',
            'registration_status': 'approved',
        })
        student_4._ensure_enrollment()

        # Publish assessments in 9A (Student 1: 90%, Student 2: 90% -> Tied Rank 1)
        self._create_and_publish_assessment(self.subject_math, 90.0, 90.0)

        # Publish assessments in 9B (Student 3: 95%, Student 4: 70%)
        assessment_b = self.env['school.assessment'].create({
            'name': 'Math Assessment 9B',
            'assessment_type': 'quiz',
            'term_id': self.term.id,
            'class_id': class_9b.id,
            'subject_id': self.subject_math.id,
            'teacher_id': self.teacher.id,
            'max_score': 100.0,
            'weight': 1.0,
            'due_date': '2099-10-15',
        })
        assessment_b.action_open()
        for mark in assessment_b.mark_ids:
            if mark.student_id == student_3:
                mark.score = 95.0
            elif mark.student_id == student_4:
                mark.score = 70.0
        assessment_b.action_submit()
        officer_ab = assessment_b.with_user(self.officer)
        officer_ab.action_approve()
        officer_ab.action_lock()
        officer_ab.action_publish()

        # Generate report cards
        card_1 = self.env['school.report.card'].generate_for(self.student_1, self.term)
        card_2 = self.env['school.report.card'].generate_for(self.student_2, self.term)
        card_3 = self.env['school.report.card'].generate_for(student_3, self.term)
        card_4 = self.env['school.report.card'].generate_for(student_4, self.term)

        # Section Rankings in 9A
        self.assertEqual(card_1.class_size, 2)
        self.assertEqual(card_2.class_size, 2)
        self.assertEqual(card_1.class_rank, 1)
        self.assertEqual(card_2.class_rank, 1)

        # Grade-Level Rankings across 9A and 9B (Total: 4 students)
        # Scores: Student 3 (95%), Student 1 (90%), Student 2 (90%), Student 4 (70%)
        self.assertEqual(card_3.grade_size, 4)
        self.assertEqual(card_3.grade_rank, 1)
        self.assertEqual(card_1.grade_rank, 2)
        self.assertEqual(card_2.grade_rank, 2)
        self.assertEqual(card_4.grade_rank, 4)  # 1224 competition ranking skips rank 3


    def test_qweb_pdf_report_rendering(self):
        self._create_and_publish_assessment(self.subject_math, 88.0, 74.0)
        card = self.env['school.report.card'].generate_for(self.student_1, self.term)
        card.with_user(self.officer).action_approve()
        card.with_user(self.officer).action_publish()

        report = self.env.ref('school_management.action_report_school_report_card')
        content, content_type = report._render_qweb_pdf(report.id, [card.id])
        self.assertEqual(content_type, 'pdf')
        self.assertTrue(len(content) > 0)