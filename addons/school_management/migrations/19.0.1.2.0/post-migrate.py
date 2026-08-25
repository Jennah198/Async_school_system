"""Academic year names became the Ethiopian year of the Gregorian start date.

Existing databases still hold the old Gregorian labels such as ``2025/2026``.
Nothing rejects them while they sit there, because the constraint only runs on
write — so the failure surfaces later, as a validation error the first time
somebody edits a year they did not rename. This converts them once.

A name already in the new form is left alone, and a conversion that would
collide with a name already taken is skipped and logged rather than forced: two
academic years cannot share an Ethiopian year, and picking a winner is a
decision for the school, not for a migration.
"""

import logging
import re

from ethiopian_date import EthiopianDateConverter

_logger = logging.getLogger(__name__)

ETHIOPIAN_NAME = re.compile(r'[0-9]{4}')


def migrate(cr, version):
    cr.execute("""
        SELECT id, name, date_start
        FROM school_academic_year
        WHERE date_start IS NOT NULL
        ORDER BY date_start
    """)
    rows = cr.fetchall()
    taken = {name for _, name, _ in rows if name and ETHIOPIAN_NAME.fullmatch(name)}
    converted, skipped = 0, []

    for year_id, name, date_start in rows:
        if name and ETHIOPIAN_NAME.fullmatch(name):
            continue
        ethiopian_name = str(EthiopianDateConverter.date_to_ethiopian(date_start).year)
        if ethiopian_name in taken:
            skipped.append((name, ethiopian_name))
            continue
        cr.execute(
            "UPDATE school_academic_year SET name = %s WHERE id = %s",
            [ethiopian_name, year_id],
        )
        taken.add(ethiopian_name)
        converted += 1
        _logger.info('Academic year %s renamed to Ethiopian year %s', name, ethiopian_name)

    _logger.info('Academic year names: %s converted, %s skipped', converted, len(skipped))
    for name, wanted in skipped:
        _logger.warning(
            'Academic year %r would become %r, which another year already uses. '
            'Left unchanged — rename it by hand to clear the clash.', name, wanted)
