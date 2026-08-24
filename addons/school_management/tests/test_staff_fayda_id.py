from psycopg2 import IntegrityError

from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase
from odoo.tools import mute_logger


class FaydaCase(TransactionCase):
    """Shared fixtures. Staff email and phone are both unique, so every record
    built here gets contact details of its own."""

    def setUp(self):
        super().setUp()
        self.job_title = self.env['school.job.title'].create({
            'name': 'FAYDA Classroom Teacher', 'department': 'academic',
        })

    def _staff(self, first_name, fayda_id, **overrides):
        seq = self.env['school.staff'].search_count([])
        values = {
            'first_name': first_name, 'last_name': 'Tester',
            'department': 'academic', 'job_title_id': self.job_title.id,
            'employment_status': 'active', 'date_of_birth': '1990-01-15',
            'phone': '+2519130%05d' % seq, 'fayda_id': fayda_id,
            'email': '%s@school.example' % first_name.lower().replace(' ', '.'),
        }
        values.update(overrides)
        return self.env['school.staff'].create(values)


class TestFaydaIdFormat(FaydaCase):
    """A Fayda number is exactly sixteen digits. Anything else is a mistyped
    identifier and has to be reported, never quietly reshaped into a
    valid-looking number that belongs to somebody else.
    """

    def test_a_sixteen_digit_number_is_accepted(self):
        staff = self._staff('FAYDA One', '1234567890123456')
        self.assertEqual(staff.fayda_id, '1234567890123456')

    def test_a_leading_zero_survives(self):
        """The reason the field is Char and not Integer: 0123456789012345 stored
        as a number reads back as 123456789012345, a different person's ID."""
        staff = self._staff('FAYDA Two', '0123456789012345')
        self.assertEqual(staff.fayda_id, '0123456789012345')
        self.assertEqual(len(staff.fayda_id), 16)

    def test_fifteen_digits_is_rejected(self):
        with self.assertRaises(ValidationError):
            self._staff('FAYDA Three', '123456789012345')

    def test_seventeen_digits_is_rejected(self):
        """Rejected outright rather than trimmed to the first sixteen."""
        with self.assertRaises(ValidationError):
            self._staff('FAYDA Four', '12345678901234567')

    def test_letters_are_rejected(self):
        with self.assertRaises(ValidationError):
            self._staff('FAYDA Five', '12345678901234AB')

    def test_separators_are_rejected(self):
        with self.assertRaises(ValidationError):
            self._staff('FAYDA Six', '1234-5678-9012-3456')

    def test_inner_spaces_are_rejected(self):
        with self.assertRaises(ValidationError):
            self._staff('FAYDA Seven', '1234 5678 9012 3456')

    def test_surrounding_whitespace_is_trimmed_not_rejected(self):
        """A copy-paste carries spaces at the ends; that is the one
        transformation applied, because it cannot change which number
        was entered."""
        staff = self._staff('FAYDA Eight', '  1234567890123457  ')
        self.assertEqual(staff.fayda_id, '1234567890123457')

    def test_a_blank_entry_is_allowed_and_stored_empty(self):
        staff = self._staff('FAYDA Nine', False)
        self.assertFalse(staff.fayda_id)

    def test_two_staff_without_a_number_do_not_collide(self):
        self._staff('FAYDA Ten', False)
        second = self._staff('FAYDA Eleven', '   ')
        self.assertFalse(second.fayda_id)

    def test_the_error_names_the_offending_value(self):
        with self.assertRaises(ValidationError) as caught:
            self._staff('FAYDA Twelve', '12345')
        self.assertIn('12345', str(caught.exception))

    def test_a_corrected_number_can_be_saved_afterwards(self):
        staff = self._staff('FAYDA Thirteen', '1234567890123458')
        staff.fayda_id = '1234567890123459'
        self.assertEqual(staff.fayda_id, '1234567890123459')


class TestFaydaIdUniqueness(FaydaCase):
    """A Fayda number identifies one person for life."""

    def test_two_staff_cannot_share_a_number(self):
        self._staff('FAYDA Dup One', '2234567890123456')
        with self.assertRaises(ValidationError):
            self._staff('FAYDA Dup Two', '2234567890123456')

    def test_the_clash_names_the_holder(self):
        self._staff('FAYDA Dup Three', '2234567890123457')
        with self.assertRaises(ValidationError) as caught:
            self._staff('FAYDA Dup Four', '2234567890123457')
        self.assertIn('FAYDA Dup Three', str(caught.exception))

    def test_moving_a_number_onto_a_taken_one_is_rejected(self):
        self._staff('FAYDA Dup Five', '2234567890123458')
        six = self._staff('FAYDA Dup Six', '2234567890123459')
        with self.assertRaises(ValidationError):
            six.fayda_id = '2234567890123458'

    def test_a_record_does_not_collide_with_itself(self):
        staff = self._staff('FAYDA Dup Seven', '2234567890123460')
        staff.write({'phone': '+251913099999'})
        self.assertEqual(staff.fayda_id, '2234567890123460')

    def test_an_archived_staff_member_keeps_holding_its_number(self):
        """Unlike a phone line, a national identifier is never reassigned. A
        returning employee reuses their archived record rather than being
        registered as a second person."""
        first = self._staff('FAYDA Dup Eight', '2234567890123461')
        first.active = False
        with self.assertRaises(ValidationError):
            self._staff('FAYDA Dup Nine', '2234567890123461')

    def test_the_database_refuses_a_duplicate_on_its_own(self):
        """The Python constraint writes the readable message; this proves the
        unique index underneath it exists, by going around the ORM."""
        self._staff('FAYDA Dup Ten', '2234567890123462')
        other = self._staff('FAYDA Dup Eleven', '2234567890123463')
        with self.assertRaises(IntegrityError), mute_logger('odoo.sql_db'):
            with self.env.cr.savepoint():
                self.env.cr.execute(
                    "UPDATE school_staff SET fayda_id = %s WHERE id = %s",
                    ['2234567890123462', other.id],
                )


class TestFaydaIdOnTeacher(FaydaCase):
    """The staff record is the source of truth; the teacher profile reads it."""

    def _active_staff(self, first_name, fayda_id):
        staff = self._staff(first_name, fayda_id)
        self.env['school.staff.responsibility'].create({
            'staff_id': staff.id, 'responsibility': 'teacher',
            'is_primary': True, 'start_date': '2026-07-01',
            'department': 'academic',
        })
        staff.action_activate()
        return staff

    def test_the_teacher_shows_the_staff_number(self):
        staff = self._active_staff('FAYDA Teacher One', '3234567890123456')
        teacher = self.env['school.teacher'].create({'staff_id': staff.id})
        self.assertEqual(teacher.fayda_id, staff.fayda_id)
        self.assertEqual(teacher.fayda_id, '3234567890123456')

    def test_correcting_the_staff_number_moves_the_teacher_value(self):
        staff = self._active_staff('FAYDA Teacher Two', '3234567890123457')
        teacher = self.env['school.teacher'].create({'staff_id': staff.id})
        staff.fayda_id = '3234567890123458'
        teacher.invalidate_recordset()
        self.assertEqual(teacher.fayda_id, '3234567890123458')

    def test_the_teacher_holds_no_column_of_its_own(self):
        """A stored copy is what would let the two drift apart, so the field
        must be related and unstored."""
        field = self.env['school.teacher']._fields['fayda_id']
        self.assertTrue(field.related)
        self.assertFalse(field.store)
        self.assertTrue(field.readonly)

    def test_the_staff_value_survives_a_write_through_the_teacher(self):
        staff = self._active_staff('FAYDA Teacher Three', '3234567890123459')
        teacher = self.env['school.teacher'].create({'staff_id': staff.id})
        teacher.invalidate_recordset()
        self.assertEqual(teacher.fayda_id, '3234567890123459')
        self.assertEqual(staff.fayda_id, '3234567890123459')


class TestFaydaIdAccess(FaydaCase):
    """A national identification number is sensitive, and is restricted to the
    same roles as the other personal data on the staff record."""

    def _user(self, login, group_name):
        return self.env['res.users'].create({
            'name': login, 'login': login,
            'email': '%s@school.example' % login,
            'group_ids': [(6, 0, [
                self.env.ref('base.group_user').id,
                self.env.ref('school_management.%s' % group_name).id,
            ])],
        })

    def test_a_registrar_can_read_it(self):
        staff = self._staff('FAYDA Access One', '4234567890123456')
        registrar = self._user('fayda_registrar', 'group_school_registrar')
        self.assertEqual(
            staff.with_user(registrar).read(['fayda_id'])[0]['fayda_id'],
            '4234567890123456')

    def test_an_hr_officer_can_read_it(self):
        staff = self._staff('FAYDA Access Two', '4234567890123457')
        hr = self._user('fayda_hr', 'group_school_hr')
        self.assertEqual(
            staff.with_user(hr).read(['fayda_id'])[0]['fayda_id'],
            '4234567890123457')

    def test_a_teacher_cannot_read_it(self):
        staff = self._staff('FAYDA Access Three', '4234567890123458')
        teacher_user = self._user('fayda_teacher', 'group_school_teacher')
        with self.assertRaises(AccessError):
            staff.with_user(teacher_user).read(['fayda_id'])

    def test_front_office_cannot_read_it(self):
        staff = self._staff('FAYDA Access Four', '4234567890123459')
        frontoffice = self._user('fayda_frontoffice', 'group_school_frontoffice')
        with self.assertRaises(AccessError):
            staff.with_user(frontoffice).read(['fayda_id'])

    def test_it_is_absent_from_the_staff_list_and_search_views(self):
        """A sensitive identifier should not be browsable in bulk."""
        for xmlid in ('view_school_staff_tree', 'view_school_staff_search'):
            view = self.env.ref('school_management.%s' % xmlid)
            self.assertNotIn('fayda_id', view.arch, xmlid)
