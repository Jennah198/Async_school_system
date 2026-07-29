from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

# Values are namespaced so the fixture never collides with seeded or demo records.
YEAR = 'TEST/2026-2027'


class TestClassSchedule(TransactionCase):

    def setUp(self):
        super().setUp()
        self.school_class = self.env['school.class'].create({
            'name': 'TEST Grade 5',
            'section': 'TEST-A',
            'academic_year': YEAR,
        })
        self.subject = self.env['school.subject'].create({'name': 'TEST Mathematics'})
        self.teacher = self.env['school.teacher'].create({'name': 'TEST Teacher One'})
        self.room = self.env['school.room'].create({'name': 'TEST Room 101'})
        self.env['school.teacher.assignment'].create({
            'teacher_id': self.teacher.id,
            'subject_id': self.subject.id,
            'class_id': self.school_class.id,
            'academic_year': YEAR,
            'term': 'term1',
        })

    def _slot(self, **overrides):
        vals = {
            'class_id': self.school_class.id,
            'subject_id': self.subject.id,
            'teacher_id': self.teacher.id,
            'term': 'term1',
            'day_of_week': '0',
            'start_time': 8.0,
            'end_time': 9.0,
            'room_id': self.room.id,
        }
        vals.update(overrides)
        return self.env['school.class.schedule'].create(vals)

    def test_overlapping_slot_is_blocked(self):
        self._slot()
        with self.assertRaises(ValidationError):
            self._slot(start_time=8.5, end_time=9.5)

    def test_back_to_back_slot_is_allowed(self):
        self._slot()
        self.assertTrue(self._slot(start_time=9.0, end_time=10.0))

    def test_same_weekday_in_other_term_is_allowed(self):
        self._slot()
        self.env['school.teacher.assignment'].create({
            'teacher_id': self.teacher.id,
            'subject_id': self.subject.id,
            'class_id': self.school_class.id,
            'academic_year': YEAR,
            'term': 'term2',
        })
        self.assertTrue(self._slot(term='term2'))

    def test_cancelled_slot_frees_the_room(self):
        self._slot().action_cancel()
        self.assertTrue(self._slot())

    def test_teacher_without_assignment_is_blocked(self):
        unassigned = self.env['school.teacher'].create({'name': 'TEST Teacher Two'})
        with self.assertRaises(ValidationError):
            self._slot(teacher_id=unassigned.id)

    def test_slot_needs_a_weekday_or_a_date(self):
        with self.assertRaises(ValidationError):
            self._slot(day_of_week=False)

    def test_inactive_teacher_cannot_be_published(self):
        slot = self._slot()
        self.teacher.teaching_status = 'inactive'
        with self.assertRaises(ValidationError):
            slot.action_publish()

    def test_reschedule_requires_a_reason(self):
        slot = self._slot()
        with self.assertRaises(ValidationError):
            slot.state = 'rescheduled'
        slot.write({'state': 'rescheduled', 'reschedule_reason': 'Teacher on leave.'})
        self.assertEqual(slot.state, 'rescheduled')

    def test_program_audience_needs_values(self):
        with self.assertRaises(ValidationError):
            self.env['school.program'].create({
                'name': 'TEST Academic Briefing',
                'audience_type': 'subject_group',
                'start_datetime': '2026-08-03 08:00:00',
                'end_datetime': '2026-08-03 10:00:00',
            })
