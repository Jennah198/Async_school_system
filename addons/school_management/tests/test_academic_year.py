from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

from .common import ethiopian_year_name, year_spanning_today

# The seeded years occupy Ethiopian 2017 to 2021, and a year name is unique, so
# tests that create their own year use Ethiopian years far outside that range.
# 2001-09-01 falls in Ethiopian 1993, 2091-09-01 in Ethiopian 2083.
HISTORICAL_START, HISTORICAL_END = '2001-09-01', '2002-06-30'
FUTURE_START, FUTURE_END = '2091-09-01', '2092-06-30'

SEEDED_PAST = 'school_management.academic_year_2025_2026'
SEEDED_CURRENT = 'school_management.academic_year_2026_2027'


class AcademicYearCase(TransactionCase):

    def _year(self, date_start, date_end, name=None, **overrides):
        values = {
            'name': name or ethiopian_year_name(date_start),
            'date_start': date_start, 'date_end': date_end,
        }
        values.update(overrides)
        return self.env['school.academic.year'].create(values)


class TestAcademicYearCreation(AcademicYearCase):
    """A year is recorded in Draft and only becomes usable when it is opened, so
    creation must accept the years a school actually has on its books: the one it
    is currently in, which started in the past, and the historical ones its
    reports and migrations refer to.

    A create-time rule rejecting any past start date made the module impossible
    to install, because its own seeded years start in the past.
    """

    def test_a_year_that_started_in_the_past_can_be_recorded(self):
        """The exact operation that used to raise 'Cannot create an academic year
        starting in the past.'"""
        year = self._year(HISTORICAL_START, HISTORICAL_END)
        self.assertEqual(year.state, 'draft')
        self.assertEqual(year.name, '1993')

    def test_a_future_year_can_still_be_recorded(self):
        year = self._year(FUTURE_START, FUTURE_END)
        self.assertEqual(year.name, '2083')

    def test_the_seeded_years_survive_installation(self):
        """This data file is what failed to load, taking the whole install down."""
        past = self.env.ref(SEEDED_PAST)
        self.assertEqual(str(past.date_start), '2025-09-01')
        self.assertEqual(past.name, '2017')
        current = self.env.ref(SEEDED_CURRENT)
        self.assertTrue(current.is_current)
        self.assertEqual(current.name, '2018')

    def test_the_name_is_the_ethiopian_year_of_the_start_date(self):
        """2025-09-01 is still Ethiopian 2017: the Ethiopian year turns on
        11 September, so an early-September date belongs to the previous one."""
        self.assertEqual(ethiopian_year_name('2025-09-01'), '2017')
        self.assertEqual(ethiopian_year_name('2025-09-20'), '2018')


class TestAcademicYearRemainsValidated(AcademicYearCase):
    """Removing the create-time rule must not remove the meaningful ones."""

    def test_a_year_that_has_ended_cannot_be_opened(self):
        """Where the date rule belongs: a finished year must never be opened for
        enrolment and attendance."""
        year = self._year(HISTORICAL_START, HISTORICAL_END)
        with self.assertRaises(ValidationError) as caught:
            year.action_open()
        self.assertIn('cannot be opened', str(caught.exception))
        self.assertEqual(year.state, 'draft')

    def test_a_year_still_running_can_be_opened(self):
        year = year_spanning_today(self.env)
        year.action_open()
        self.assertEqual(year.state, 'open')

    def test_only_a_draft_year_can_be_opened(self):
        year = year_spanning_today(self.env)
        year.action_open()
        with self.assertRaises(ValidationError):
            year.action_open()

    def test_the_name_must_match_the_ethiopian_start_year(self):
        with self.assertRaises(ValidationError):
            self._year(FUTURE_START, FUTURE_END, name='1993')

    def test_the_name_must_be_four_digits(self):
        with self.assertRaises(ValidationError):
            self._year(FUTURE_START, FUTURE_END, name='next year')

    def test_a_gregorian_span_is_no_longer_accepted_as_a_name(self):
        """The old YYYY/YYYY form is now invalid — worth pinning, because seed
        data and fixtures used it everywhere."""
        with self.assertRaises(ValidationError):
            self._year(FUTURE_START, FUTURE_END, name='2091/2092')

    def test_the_end_date_must_follow_the_start_date(self):
        with self.assertRaises(Exception):
            with self.env.cr.savepoint():
                self._year('2001-09-01', '2001-08-31')

    def test_only_one_year_is_the_current_one(self):
        """A seeded year already holds it."""
        with self.assertRaises(ValidationError):
            self._year(HISTORICAL_START, HISTORICAL_END, is_current=True)

    def test_one_academic_year_per_ethiopian_year(self):
        """The name is unique and derived from the Ethiopian year, so a second
        year inside the same Ethiopian year cannot be recorded."""
        with self.assertRaises(Exception):
            with self.env.cr.savepoint():
                self._year('2026-09-20', '2027-06-30')  # Ethiopian 2019... clashes

    def test_a_closed_year_stays_read_only(self):
        year = year_spanning_today(self.env)
        year.action_open()
        year.action_close()
        with self.assertRaises(ValidationError):
            year.write({'date_end': '2099-06-30'})
