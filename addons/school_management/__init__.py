# -*- coding: utf-8 -*-

from . import models
# from . import wizards


def backfill_subject_codes(env):
    env['school.subject']._backfill_missing_codes()