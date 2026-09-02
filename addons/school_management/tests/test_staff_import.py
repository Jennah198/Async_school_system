import base64

from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

from ..models.school_staff_import import (
    DEPARTMENT_MAP, IMPORT_MODULE, TEACHING_STAFF,
)


class ImportCase(TransactionCase):

    def setUp(self):
        super().setUp()
        self.Import = self.env['school.staff.import']

    def _row(self, **overrides):
        row = {
            'staff_id': 'TST001', 'first_name': 'Import', 'last_name': 'Tester',
            'gender': 'Male', 'qualification': 'BSc Testing',
            'department': 'Science', 'employment_status': 'Active',
            'hire_date': '2019-10-21',
        }
        row.update(overrides)
        return row


class TestStaffImportSource(ImportCase):
    """The CSV is a verbatim copy of the staff table in the dataset, and is the
    audit trail for what was imported."""

    def test_the_source_holds_every_row_of_the_staff_table(self):
        self.assertEqual(len(self.Import._read_source()), 20)

    def test_every_source_department_has_a_declared_mapping(self):
        """An unmapped department would silently skip that person on import."""
        for row in self.Import._read_source():
            with self.subTest(staff=row['staff_id']):
                self.assertIn(row['department'].lower(), DEPARTMENT_MAP)

    def test_every_source_row_carries_the_columns_the_import_reads(self):
        for row in self.Import._read_source():
            for column in ('staff_id', 'first_name', 'last_name',
                           'employment_status', 'hire_date'):
                with self.subTest(staff=row['staff_id'], column=column):
                    self.assertTrue(row[column].strip())

    def test_source_staff_ids_are_unique(self):
        ids = [row['staff_id'] for row in self.Import._read_source()]
        self.assertEqual(len(ids), len(set(ids)))


class TestStaffImportMapping(ImportCase):
    """Every transformation is explicit; nothing is invented."""

    def test_a_teaching_area_becomes_the_academic_department(self):
        values = self.Import._values_from_row(self._row(department='Mathematics'))
        self.assertEqual(values['department'], 'academic')

    def test_administration_maps_to_itself(self):
        values = self.Import._values_from_row(self._row(department='Administration'))
        self.assertEqual(values['department'], 'administration')

    def test_ict_maps_to_the_it_department(self):
        values = self.Import._values_from_row(self._row(department='ICT'))
        self.assertEqual(values['department'], 'it')

    def test_gender_and_status_are_translated_to_the_odoo_values(self):
        values = self.Import._values_from_row(
            self._row(gender='Female', employment_status='Active'))
        self.assertEqual(values['gender'], 'female')
        self.assertEqual(values['employment_status'], 'active')

    def test_the_hire_date_keeps_its_day_and_drops_the_time(self):
        values = self.Import._values_from_row(
            self._row(hire_date='2019-10-21 00:00:00'))
        self.assertEqual(values['hire_date'], '2019-10-21')

    def test_names_are_carried_across_untouched(self):
        """A person's name is never reformatted by the import."""
        values = self.Import._values_from_row(
            self._row(first_name='Mohammed', last_name='Seid'))
        self.assertEqual(values['first_name'], 'Mohammed')
        self.assertEqual(values['last_name'], 'Seid')

    def test_no_fayda_id_is_produced_from_a_source_without_one(self):
        """The dataset has no Fayda column, and the import does not fabricate one."""
        self.assertNotIn('fayda_id', self.Import._values_from_row(self._row()))


class TestStaffImportValidation(ImportCase):
    """A row that cannot be trusted is reported, never forced through."""

    def test_an_unknown_department_is_reported_and_the_row_held_back(self):
        report = self.Import.dry_run(rows=[self._row(department='Astrophysics')])
        self.assertIn('TST001: Astrophysics', report['unknown_department'])
        self.assertNotIn('TST001', report['importable'])

    def test_an_unknown_employment_status_is_reported(self):
        report = self.Import.dry_run(rows=[self._row(employment_status='Seconded')])
        self.assertIn('TST001: Seconded', report['unknown_employment_status'])
        self.assertNotIn('TST001', report['importable'])

    def test_a_malformed_fayda_id_in_the_source_is_reported(self):
        report = self.Import.dry_run(rows=[self._row(fayda_id='12345')])
        self.assertIn('TST001: 12345', report['invalid_fayda'])

    def test_a_valid_fayda_id_in_the_source_is_not_reported(self):
        report = self.Import.dry_run(rows=[self._row(fayda_id='1234567890123456')])
        self.assertFalse(report['invalid_fayda'])

    def test_a_repeated_source_id_is_reported(self):
        report = self.Import.dry_run(rows=[self._row(), self._row()])
        self.assertIn('TST001', report['duplicate_source_ids'])

    def test_two_people_sharing_a_name_in_the_source_are_reported(self):
        report = self.Import.dry_run(rows=[
            self._row(staff_id='TST001'), self._row(staff_id='TST002')])
        self.assertTrue(report['duplicate_source_names'])

    def test_a_name_matching_an_existing_staff_member_goes_to_review(self):
        """Never merged on a name alone — two people can share one."""
        job_title = self.env['school.job.title'].create({
            'name': 'IMP Teacher', 'department': 'academic'})
        self.env['school.staff'].create({
            'first_name': 'Import', 'last_name': 'Tester',
            'department': 'academic', 'job_title_id': job_title.id,
            'phone': '+251913500001',
        })
        report = self.Import.dry_run(rows=[self._row()])
        self.assertTrue(report['name_matches_existing'])
        self.assertNotIn('TST001', report['importable'])

    def test_a_source_column_with_no_destination_is_named(self):
        """qualification exists in the dataset but not on school.staff, so the
        import says so rather than dropping it silently."""
        report = self.Import.dry_run()
        self.assertIn('qualification', report['unmapped_source_columns'])


class TestStaffImportOutcome(ImportCase):
    """What the imported records are, and what they deliberately are not."""

    def test_an_imported_record_cannot_be_activated_yet(self):
        """The dataset carries no birth date, phone, job title or responsibility,
        so an imported record stops at Draft instead of being completed with
        invented values."""
        staff = self.env['school.staff'].create(
            self.Import._values_from_row(self._row()))
        self.assertEqual(staff.state, 'draft')
        with self.assertRaises(ValidationError):
            staff.action_activate()

    def test_the_import_reports_what_activation_still_needs(self):
        report = self.Import.dry_run()
        for missing in ('Date of Birth', 'Primary Phone', 'Job Title'):
            self.assertIn(missing, report['missing_in_source'])

    def test_the_teaching_staff_are_the_ones_the_dataset_assigns_to_classes(self):
        self.assertEqual(len(TEACHING_STAFF), 12)
        source_ids = {row['staff_id'] for row in self.Import._read_source()}
        self.assertTrue(TEACHING_STAFF.issubset(source_ids))

    def test_no_teacher_profile_is_created_by_the_import(self):
        """A teacher profile needs an active staff record, and none of these can
        be activated from the source alone."""
        before = self.env['school.teacher'].search_count([])
        self.Import.run_import()
        self.assertEqual(self.env['school.teacher'].search_count([]), before)

    def test_running_the_import_twice_creates_nothing_the_second_time(self):
        self.Import.run_import()
        tagged = self.env['ir.model.data'].search_count([
            ('module', '=', IMPORT_MODULE)])
        second = self.Import.run_import()
        self.assertFalse(second['created'])
        self.assertEqual(
            self.env['ir.model.data'].search_count([('module', '=', IMPORT_MODULE)]),
            tagged)

    def test_the_import_does_not_touch_records_it_did_not_create(self):
        job_title = self.env['school.job.title'].create({
            'name': 'IMP Untouched', 'department': 'academic'})
        outsider = self.env['school.staff'].create({
            'first_name': 'Unrelated', 'last_name': 'Person',
            'department': 'academic', 'job_title_id': job_title.id,
            'phone': '+251913500002', 'employment_status': 'on_leave',
        })
        self.Import.run_import()
        outsider.invalidate_recordset()
        self.assertTrue(outsider.active)
        self.assertEqual(outsider.employment_status, 'on_leave')


class TestStaffImportUpload(ImportCase):
    """An uploaded file goes through exactly the same analysis as the bundled
    source. These cover the parsing that is new; the mapping and validation are
    already covered above and are deliberately not duplicated."""

    def _upload(self, text):
        return base64.b64encode(text.encode('utf-8')).decode('ascii')

    def test_an_uploaded_csv_is_analysed_like_the_bundled_source(self):
        report = self.Import.dry_run_upload(self._upload(
            'staff_id,first_name,last_name,gender,department,employment_status,hire_date\n'
            'UP001,Selam,Kebede,Female,Mathematics,Active,2026-01-15\n'))
        self.assertEqual(report['source_rows'], 1)
        self.assertEqual(report['importable'], ['UP001'])

    def test_an_unknown_department_is_reported_and_skipped(self):
        report = self.Import.dry_run_upload(self._upload(
            'staff_id,first_name,last_name,gender,department,employment_status,hire_date\n'
            'UP002,Selam,Kebede,Female,Astrophysics,Active,2026-01-15\n'))
        self.assertFalse(report['importable'])
        self.assertTrue(report['unknown_department'])

    def test_a_column_with_nowhere_to_go_is_named(self):
        report = self.Import.dry_run_upload(self._upload(
            'staff_id,first_name,last_name,gender,department,employment_status,hire_date,nickname\n'
            'UP003,Selam,Kebede,Female,Mathematics,Active,2026-01-15,Sela\n'))
        self.assertIn('nickname', report['unmapped_source_columns'])

    def test_a_byte_order_mark_does_not_break_the_first_column(self):
        text = ('staff_id,first_name,last_name,gender,department,employment_status,hire_date\n'
                'UP004,Selam,Kebede,Female,Mathematics,Active,2026-01-15\n')
        payload = base64.b64encode(('﻿' + text).encode('utf-8')).decode('ascii')
        self.assertEqual(self.Import.dry_run_upload(payload)['importable'], ['UP004'])

    def test_a_header_with_no_rows_is_refused(self):
        with self.assertRaises(ValidationError):
            self.Import.dry_run_upload(self._upload('staff_id,first_name\n'))

    def test_a_file_that_is_not_utf8_is_refused(self):
        with self.assertRaises(ValidationError):
            self.Import.dry_run_upload(base64.b64encode(b'\xff\xfe\x00bad').decode('ascii'))

    def test_uploading_creates_only_the_rows_the_analysis_cleared(self):
        payload = self._upload(
            'staff_id,first_name,last_name,gender,department,employment_status,hire_date\n'
            'UP005,Selam,Kebede,Female,Mathematics,Active,2026-01-15\n'
            'UP006,Hanna,Girma,Female,Astrophysics,Active,2026-01-15\n')
        report = self.Import.run_import_upload(payload)
        self.assertEqual(report['created'], ['UP005'])
        staff = self.env['school.staff'].search([('last_name', '=', 'Kebede')])
        self.assertEqual(staff.state, 'draft')
