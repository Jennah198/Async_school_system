import base64
import csv
import io
import logging

from odoo import api, models
from odoo.exceptions import AccessError, ValidationError
from odoo.tools import file_open

from .school_staff import FAYDA_ID_PATTERN

_logger = logging.getLogger(__name__)

SOURCE_FILE = 'school_management/data/staff_import_source.csv'

# The source column reads "department", but its values are subject areas and
# organisational units mixed together, while school.staff.department is a fixed
# organisational list. Every transformation below is stated here rather than
# guessed per row, so a reviewer can check the whole mapping in one place.
#
#   Administration      -> administration   exact match on the Odoo label
#   ICT                 -> it               same organisational unit, different name
#   everything else     -> academic         Mathematics, Science, Languages, Social
#                                           Studies and Physical Education are
#                                           teaching areas, not departments in this
#                                           model's vocabulary; all of them are
#                                           academic staff.
#
# A value that is not listed is reported as unknown and its row is skipped. No
# department is ever created to accommodate the data.
DEPARTMENT_MAP = {
    'administration': 'administration',
    'ict': 'it',
    'mathematics': 'academic',
    'science': 'academic',
    'languages': 'academic',
    'social studies': 'academic',
    'physical education': 'academic',
}

GENDER_MAP = {'male': 'male', 'female': 'female'}

EMPLOYMENT_STATUS_MAP = {
    'active': 'active',
    'on leave': 'on_leave',
    'resigned': 'resigned',
    'terminated': 'terminated',
    'retired': 'retired',
}

# Derived from section 3 of the same PDF: these staff appear as a class teacher or
# on a subject assignment. The other rows never do. Recorded here rather than in
# the source CSV, which stays a verbatim copy of the staff table on page 9.
TEACHING_STAFF = {
    'STF001', 'STF002', 'STF003', 'STF004', 'STF005', 'STF006',
    'STF007', 'STF008', 'STF009', 'STF010', 'STF011', 'STF012',
}

# Imported records are tagged in their own xmlid namespace, not the module's. A
# module-owned xmlid that is absent from the manifest's data files is deleted on
# the next upgrade, which would silently remove imported staff.
IMPORT_MODULE = '__staff_import__'

# What school.staff needs before it can leave Draft, and whether the source can
# supply it. The dataset carries none of these, which is why every imported record
# stops at Draft.
NOT_IN_SOURCE = ('Date of Birth', 'Primary Phone', 'Job Title', 'Responsibility')


class SchoolStaffImport(models.AbstractModel):
    """Loads the staff table of the sample dataset into school.staff.

    Two entry points: dry_run() reports what would happen and changes nothing,
    run_import() applies it. Both are repeatable — a row already imported is
    recognised by its xmlid and left alone rather than duplicated.

    The importer never invents a value. A field the source does not carry stays
    empty and is reported, and a value that does not match an existing Odoo
    vocabulary is reported and its row skipped.
    """

    _name = 'school.staff.import'
    _description = 'Staff Dataset Import'

    # ------------------------------------------------------------------ source

    @api.model
    def _read_source(self):
        with file_open(SOURCE_FILE, mode='r') as handle:
            return list(csv.DictReader(handle))

    @api.model
    def _rows_from_upload(self, content):
        """An uploaded CSV, in the same row shape `_read_source` returns.

        utf-8-sig because a spreadsheet export usually carries a BOM, and the
        first column header is what every row is keyed by.
        """
        try:
            text = base64.b64decode(content).decode('utf-8-sig')
        except (ValueError, UnicodeDecodeError) as error:
            raise ValidationError(
                'That file could not be read as UTF-8 CSV.') from error
        rows = list(csv.DictReader(io.StringIO(text)))
        if not rows:
            raise ValidationError('That file has a header but no rows.')
        return rows

    @api.model
    def dry_run_upload(self, content):
        """Analyse an uploaded CSV without writing anything."""
        self._require_importer()
        return self._analyse(rows=self._rows_from_upload(content))

    @api.model
    def run_import_upload(self, content):
        """Import an uploaded CSV, on exactly the terms `run_import` uses."""
        return self.run_import(rows=self._rows_from_upload(content))

    @api.model
    def _require_importer(self):
        if not self.env.user.has_group('base.group_system'):
            raise AccessError('Only a system administrator can import staff data.')

    @api.model
    def _existing_record(self, source_id):
        return self.env.ref('%s.staff_%s' % (IMPORT_MODULE, source_id),
                            raise_if_not_found=False)

    # ---------------------------------------------------------------- analysis

    @api.model
    def _analyse(self, rows=None):
        """Validate every row against the live Odoo vocabularies and existing
        records. Returns the findings; writes nothing.

        rows is injectable so the validation can be exercised against a bad row
        without a malformed file having to exist in the repository.
        """
        Staff = self.env['school.staff'].with_context(active_test=False)
        rows = self._read_source() if rows is None else rows

        report = {
            'source_rows': len(rows),
            'importable': [],
            'already_imported': [],
            'unknown_department': [],
            'unknown_employment_status': [],
            'unknown_gender': [],
            'invalid_fayda': [],
            'missing_in_source': list(NOT_IN_SOURCE),
            'name_matches_existing': [],
            'unmapped_source_columns': [],
            'teaching_staff': [],
            'duplicate_source_ids': [],
            'duplicate_source_names': [],
        }

        # A field present in the source with nowhere to put it is data that would
        # be lost on import, so it is named rather than dropped quietly.
        known_columns = {
            'staff_id', 'first_name', 'last_name', 'gender',
            'department', 'employment_status', 'hire_date',
        }
        for column in (rows[0].keys() if rows else []):
            if column not in known_columns:
                report['unmapped_source_columns'].append(column)

        seen_ids, seen_names = set(), {}
        for row in rows:
            source_id = (row.get('staff_id') or '').strip()
            first = (row.get('first_name') or '').strip()
            last = (row.get('last_name') or '').strip()
            full_name = '%s %s' % (first, last)

            if source_id in seen_ids:
                report['duplicate_source_ids'].append(source_id)
            seen_ids.add(source_id)
            if full_name in seen_names:
                report['duplicate_source_names'].append(
                    '%s (%s and %s)' % (full_name, seen_names[full_name], source_id))
            seen_names[full_name] = source_id

            # The dataset has no Fayda column at all; the check runs anyway so a
            # future revision of the file cannot slip an invalid one past.
            fayda = (row.get('fayda_id') or '').strip()
            if fayda and not FAYDA_ID_PATTERN.fullmatch(fayda):
                report['invalid_fayda'].append('%s: %s' % (source_id, fayda))

            department = (row.get('department') or '').strip()
            if department.lower() not in DEPARTMENT_MAP:
                report['unknown_department'].append('%s: %s' % (source_id, department))
                continue

            status = (row.get('employment_status') or '').strip()
            if status.lower() not in EMPLOYMENT_STATUS_MAP:
                report['unknown_employment_status'].append('%s: %s' % (source_id, status))
                continue

            gender = (row.get('gender') or '').strip()
            if gender and gender.lower() not in GENDER_MAP:
                report['unknown_gender'].append('%s: %s' % (source_id, gender))
                continue

            if self._existing_record(source_id):
                report['already_imported'].append(source_id)
                continue

            # Names are compared only to raise a flag. Two people can share a name,
            # and the source has no identifier strong enough to merge on, so a match
            # is sent for review instead of being treated as the same person.
            clash = Staff.search([('name', '=ilike', full_name)], limit=1)
            if clash:
                report['name_matches_existing'].append(
                    '%s: %s already exists as staff id %s' % (
                        source_id, full_name, clash.staff_id or clash.id))
                continue

            report['importable'].append(source_id)
            if source_id in TEACHING_STAFF:
                report['teaching_staff'].append(source_id)

        return report

    @api.model
    def dry_run(self, rows=None):
        report = self._analyse(rows=rows)
        _logger.info('Staff import dry run: %s', report)
        return report

    # ------------------------------------------------------------------ import

    @api.model
    def _values_from_row(self, row):
        return {
            'first_name': (row.get('first_name') or '').strip(),
            'last_name': (row.get('last_name') or '').strip(),
            'gender': GENDER_MAP.get((row.get('gender') or '').strip().lower(), False),
            'department': DEPARTMENT_MAP[(row.get('department') or '').strip().lower()],
            'employment_status': EMPLOYMENT_STATUS_MAP[
                (row.get('employment_status') or '').strip().lower()],
            'hire_date': (row.get('hire_date') or '').strip()[:10] or False,
        }

    @api.model
    def run_import(self, rows=None):
        """Create the staff the dry run cleared. Nothing is updated or deleted:
        a row already imported, or one the dry run held back, is left alone.

        Records land in Draft and stay there. Activation needs a birth date, a
        phone number, a job title and a responsibility, none of which the source
        carries, and inventing them is exactly what an import must not do.
        """
        self._require_importer()

        source = self._read_source() if rows is None else rows
        report = self._analyse(rows=source)
        rows = {r['staff_id'].strip(): r for r in source}
        created = []

        for source_id in report['importable']:
            staff = self.env['school.staff'].create(self._values_from_row(rows[source_id]))
            self.env['ir.model.data'].create({
                'module': IMPORT_MODULE,
                'name': 'staff_%s' % source_id,
                'model': 'school.staff',
                'res_id': staff.id,
                'noupdate': True,
            })
            created.append(source_id)

        report['created'] = created
        _logger.info('Staff import created %s record(s): %s', len(created), created)
        return report
