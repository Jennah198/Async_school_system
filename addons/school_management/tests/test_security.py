import base64

from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase

YEAR = 'SEC/2026-2027'
DUMMY_FILE = base64.b64encode(b'fictional test document')


class TestSchoolSecurity(TransactionCase):
    """Proves the role isolation the brief calls non-negotiable in section 13."""

    def setUp(self):
        super().setUp()
        self.class_a = self._class('SEC Grade 1', 'A')
        self.class_b = self._class('SEC Grade 2', 'B')
        self.math = self.env['school.subject'].create({'name': 'SEC Mathematics'})
        self.history = self.env['school.subject'].create({'name': 'SEC History'})

        self.teacher_user = self._user('sec_teacher_a', 'group_school_teacher')
        self.plain_staff_user = self._user('sec_staff_only', 'group_school_staff')

        self.teacher_a = self._teacher('SEC Teacher A', self.teacher_user)
        self.teacher_b = self._teacher('SEC Teacher B', self._user('sec_teacher_b', 'group_school_teacher'))
        self._assign(self.teacher_a, self.math, self.class_a)
        self._assign(self.teacher_b, self.history, self.class_b)

        self.student_a = self._student('SEC Student A', self.class_a)
        self.student_b = self._student('SEC Student B', self.class_b)

    # ---------- fixtures ----------

    def _class(self, name, section):
        return self.env['school.class'].create({
            'name': name, 'section': section, 'academic_year': YEAR,
            'is_entry_level': True,
        })

    def _user(self, login, group_name):
        return self.env['res.users'].create({
            'name': login, 'login': login,
            'groups_id': [(6, 0, [
                self.env.ref('base.group_user').id,
                self.env.ref(f'school_management.{group_name}').id,
            ])],
        })

    def _teacher(self, name, user):
        staff = self.env['school.staff'].create({
            'name': name, 'department': 'academic',
            'employment_status': 'active', 'user_id': user.id,
        })
        return self.env['school.teacher'].create({'name': name, 'staff_id': staff.id})

    def _assign(self, teacher, subject, school_class):
        return self.env['school.teacher.assignment'].create({
            'teacher_id': teacher.id, 'subject_id': subject.id,
            'class_id': school_class.id, 'term': 'term1',
        })

    def _student(self, name, school_class):
        return self.env['school.student'].create({
            'name': name, 'class_id': school_class.id,
            'date_of_birth': '2015-05-05',
            'guardian_name': 'SEC Guardian',
            'guardian_phone': '+251911234567',
            'birth_certificate': DUMMY_FILE,
            'registration_status': 'approved',
        })

    def _mark(self, student, subject):
        return self.env['school.mark'].create({
            'student_id': student.id, 'subject_id': subject.id,
            'term': 'term1', 'exam_type': 'test', 'score': 70.0,
        })

    def _attendance(self, student):
        return self.env['school.attendance'].create({
            'student_id': student.id, 'date': '2026-08-03', 'status': 'present',
        })

    def _announcement(self, name, **overrides):
        vals = {'name': name, 'message': '<p>body</p>', 'audience_type': 'all_staff'}
        vals.update(overrides)
        record = self.env['school.announcement'].create(vals)
        if vals.get('state') != 'draft':
            record.action_publish()
        return record

    # ---------- section 9: attendance and marks are scoped to assignments ----------

    def test_teacher_sees_attendance_only_for_assigned_classes(self):
        self._attendance(self.student_a)
        self._attendance(self.student_b)
        visible = self.env['school.attendance'].with_user(self.teacher_user).search([])
        self.assertEqual(visible.student_id, self.student_a)

    def test_teacher_sees_marks_only_for_assigned_class_and_subject(self):
        self._mark(self.student_a, self.math)
        self._mark(self.student_b, self.history)
        visible = self.env['school.mark'].with_user(self.teacher_user).search([])
        self.assertEqual(visible.student_id, self.student_a)

    def test_teacher_sees_students_only_for_assigned_classes(self):
        visible = self.env['school.student'].with_user(self.teacher_user).search([])
        self.assertIn(self.student_a, visible)
        self.assertNotIn(self.student_b, visible)

    # ---------- section 8: announcement audiences ----------

    def test_all_staff_announcement_is_visible(self):
        live = self._announcement('SEC All Staff')
        visible = self.env['school.announcement'].with_user(self.teacher_user).search([])
        self.assertIn(live, visible)

    def test_announcement_for_another_class_is_hidden(self):
        targeted = self._announcement(
            'SEC Class B Only', audience_type='class_section', class_ids=[(6, 0, self.class_b.ids)],
        )
        visible = self.env['school.announcement'].with_user(self.teacher_user).search([])
        self.assertNotIn(targeted, visible)

    def test_announcement_for_own_class_is_visible(self):
        targeted = self._announcement(
            'SEC Class A Only', audience_type='class_section', class_ids=[(6, 0, self.class_a.ids)],
        )
        visible = self.env['school.announcement'].with_user(self.teacher_user).search([])
        self.assertIn(targeted, visible)

    def test_draft_announcement_is_hidden_from_the_audience(self):
        draft = self._announcement('SEC Draft', state='draft')
        visible = self.env['school.announcement'].with_user(self.teacher_user).search([])
        self.assertNotIn(draft, visible)

    def test_expired_announcement_is_hidden(self):
        expired = self._announcement(
            'SEC Expired',
            publish_datetime='2026-01-01 08:00:00', expiry_datetime='2026-01-02 08:00:00',
        )
        visible = self.env['school.announcement'].with_user(self.teacher_user).search([])
        self.assertNotIn(expired, visible)

    def test_subject_targeted_announcement_respects_taught_subjects(self):
        mine = self._announcement(
            'SEC Maths Teachers', audience_type='subject_group', subject_ids=[(6, 0, self.math.ids)],
        )
        theirs = self._announcement(
            'SEC History Teachers', audience_type='subject_group', subject_ids=[(6, 0, self.history.ids)],
        )
        visible = self.env['school.announcement'].with_user(self.teacher_user).search([])
        self.assertIn(mine, visible)
        self.assertNotIn(theirs, visible)

    # ---------- section 4 and 13: private documents ----------

    def test_staff_documents_are_private_to_the_registrar(self):
        staff = self.teacher_a.staff_id
        staff.id_document = DUMMY_FILE
        with self.assertRaises(AccessError):
            staff.with_user(self.teacher_user).read(['id_document'])

    def test_plain_staff_sees_only_their_own_staff_record(self):
        visible = self.env['school.staff'].with_user(self.plain_staff_user).search([])
        self.assertFalse(visible)

    # ---------- schedule scoping ----------

    def test_teacher_sees_own_draft_schedule_but_not_another_teachers(self):
        mine = self.env['school.class.schedule'].create({
            'class_id': self.class_a.id, 'subject_id': self.math.id,
            'teacher_id': self.teacher_a.id, 'term': 'term1',
            'day_of_week': '0', 'start_time': 8.0, 'end_time': 9.0,
        })
        theirs = self.env['school.class.schedule'].create({
            'class_id': self.class_b.id, 'subject_id': self.history.id,
            'teacher_id': self.teacher_b.id, 'term': 'term1',
            'day_of_week': '0', 'start_time': 8.0, 'end_time': 9.0,
        })
        visible = self.env['school.class.schedule'].with_user(self.teacher_user).search([])
        self.assertIn(mine, visible)
        self.assertNotIn(theirs, visible)
