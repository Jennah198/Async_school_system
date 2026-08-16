from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase


class TestStaffEmailUniqueness(TransactionCase):
    """A staff email becomes the Odoo login of any teacher profile built on it,
    and logins are unique database-wide. Two staff records sharing an address
    therefore fail late, with a raw constraint error at login creation, unless
    registration rejects the duplicate up front.
    """

    def setUp(self):
        super().setUp()
        self.job_title = self.env['school.job.title'].create({
            'name': 'EMAIL Classroom Teacher', 'department': 'academic',
        })

    def _staff(self, first_name, email):
        return self.env['school.staff'].create({
            'first_name': first_name, 'last_name': 'Tester',
            'department': 'academic', 'job_title_id': self.job_title.id,
            'phone': '+251911000000', 'email': email,
        })

    def test_duplicate_email_is_rejected(self):
        self._staff('EMAIL One', 'shared@school.example')
        with self.assertRaises(ValidationError):
            self._staff('EMAIL Two', 'shared@school.example')

    def test_duplicate_email_is_rejected_whatever_the_case(self):
        self._staff('EMAIL Three', 'mixed.case@school.example')
        with self.assertRaises(ValidationError):
            self._staff('EMAIL Four', 'Mixed.Case@School.Example')

    def test_a_named_address_does_not_slip_past_the_check(self):
        self._staff('EMAIL Five', 'named@school.example')
        with self.assertRaises(ValidationError):
            self._staff('EMAIL Six', 'Someone Else <named@school.example>')

    def test_archived_staff_keeps_holding_its_address(self):
        first = self._staff('EMAIL Seven', 'archived@school.example')
        first.active = False
        with self.assertRaises(ValidationError):
            self._staff('EMAIL Eight', 'archived@school.example')

    def test_moving_an_address_onto_a_taken_one_is_rejected(self):
        self._staff('EMAIL Nine', 'nine@school.example')
        ten = self._staff('EMAIL Ten', 'ten@school.example')
        with self.assertRaises(ValidationError):
            ten.email = 'nine@school.example'

    def test_a_record_does_not_collide_with_itself(self):
        staff = self._staff('EMAIL Eleven', 'eleven@school.example')
        staff.write({'phone': '+251911000111'})
        self.assertEqual(staff.email, 'eleven@school.example')

    def test_underscore_is_not_read_as_a_wildcard(self):
        """'a_b@' must not match 'axb@' — =ilike would treat the underscore as
        'any character' if the pattern were passed through unescaped."""
        self._staff('EMAIL Twelve', 'a_b@school.example')
        other = self._staff('EMAIL Thirteen', 'axb@school.example')
        self.assertTrue(other.id)

    def test_the_stored_address_is_normalized(self):
        staff = self._staff('EMAIL Fourteen', ' Fourteen@School.Example ')
        self.assertEqual(staff.email, 'fourteen@school.example')

    def test_an_unusable_address_is_still_rejected(self):
        with self.assertRaises(ValidationError):
            self._staff('EMAIL Fifteen', 'not-an-address')

    def test_staff_without_an_address_do_not_collide(self):
        self._staff('EMAIL Sixteen', False)
        second = self._staff('EMAIL Seventeen', False)
        self.assertTrue(second.id)
