from dateutil.relativedelta import relativedelta

from odoo import fields
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

# The module seeds 2025/2026 through 2029/2030, and the year name is unique, so
# these tests either span two calendar years — which the seeded consecutive years
# never do — or sit far outside that range.
SEEDED_CURRENT = 'school_management.academic_year_2026_2027'
SEEDED_PAST = 'school_management.academic_year_2025_2026'


class AcademicYearCase(TransactionCase):

    def setUp(self):
        super().setUp()
        self.today = fields.Date.context_today(self.env['school.academic.year'])

    def _year(self, name, date_start, date_end, **overrides):
        values = {'name': name, 'date_start': date_start, 'date_end': date_end}
        values.update(overrides)
        return self.env['school.academic.year'].create(values)

    def _spanning_today(self, **overrides):
        """A year that has already started and has not yet ended."""
        start = self.today - relativedelta(years=1)
        end = self.today + relativedelta(years=1)
        return self._year('%s/%s' % (start.year, end.year), start, end, **overrides)


class TestAcademicYearCreation(AcademicYearCase):
    """A year is recorded in Draft and only becomes usable when it is opened, so
    creation must accept the years a school actually has on its books: the one it
    is currently in, which started in the past, and the historical ones its
    reports and migrations refer to.

    A create-time rule rejecting any past start date made the module impossible
    to install, because its own seeded 2025/2026 year is in the past.
    """

    def test_a_year_that_has_already_started_can_be_recorded(self):
        """The exact operation that used to raise 'Cannot create an academic year
        starting in the past.'"""
        year = self._spanning_today()
        self.assertEqual(year.state, 'draft')
        self.assertLess(year.date_start, self.today)

    def test_a_fully_historical_year_can_be_recorded(self):
        """Needed for reporting on finished years and for migrated data."""
        year = self._year('2001/2002', '2001-09-01', '2002-06-30')
        self.assertTrue(year.id)

    def test_a_future_year_can_still_be_recorded(self):
        year = self._year('2091/2092', '2091-09-01', '2092-06-30')
        self.assertTrue(year.id)

    def test_the_seeded_years_survive_installation(self):
        """This data file is what failed to load, taking the whole install with it."""
        past = self.env.ref(SEEDED_PAST)
        self.assertEqual(str(past.date_start), '2025-09-01')
        current = self.env.ref(SEEDED_CURRENT)
        self.assertTrue(current.is_current)


class TestAcademicYearRemainsValidated(AcademicYearCase):
    """Removing the create-time rule must not remove the meaningful ones."""

    def test_a_year_that_has_ended_cannot_be_opened(self):
        """Where the date rule belongs: a finished year must never be opened for
        enrolment and attendance."""
        year = self._year('2001/2002', '2001-09-01', '2002-06-30')
        with self.assertRaises(ValidationError) as caught:
            year.action_open()
        self.assertIn('cannot be opened', str(caught.exception))
        self.assertEqual(year.state, 'draft')

    def test_a_year_still_running_can_be_opened(self):
        year = self._spanning_today()
        year.action_open()
        self.assertEqual(year.state, 'open')

    def test_only_a_draft_year_can_be_opened(self):
        year = self._spanning_today()
        year.action_open()
        with self.assertRaises(ValidationError):
            year.action_open()

    def test_the_name_must_match_the_dates(self):
        with self.assertRaises(ValidationError):
            self._year('2001/2002', '2091-09-01', '2092-06-30')

    def test_the_name_must_use_the_four_digit_format(self):
        with self.assertRaises(ValidationError):
            self._year('next year', '2091-09-01', '2092-06-30')

    def test_the_end_date_must_follow_the_start_date(self):
        with self.assertRaises(Exception):
            with self.env.cr.savepoint():
                self._year('2091/2091', '2091-09-01', '2091-08-31')

    def test_only_one_year_is_the_current_one(self):
        """A seeded year already holds it."""
        with self.assertRaises(ValidationError):
            self._year('2091/2092', '2091-09-01', '2092-06-30', is_current=True)

    def test_a_duplicate_year_name_is_refused(self):
        with self.assertRaises(Exception):
            with self.env.cr.savepoint():
                self._year('2026/2027', '2026-09-01', '2027-06-30')

    def test_a_closed_year_stays_read_only(self):
        year = self._spanning_today()
        year.action_open()
        year.action_close()
        with self.assertRaises(ValidationError):
            year.write({'date_end': self.today + relativedelta(years=2)})
