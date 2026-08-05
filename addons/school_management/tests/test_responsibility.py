from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

YEAR = 'RESP/2026-2027'


class TestResponsibilityAndStaffControl(TransactionCase):
    """Brief sections 4, 5, 6 and the section 13 lines that depend on them."""

    def setUp(self):
        super().setUp()
        self.campus_main = self.env['school.campus'].create({'name': 'RESP Main'})
        self.campus_east = self.env['school.campus'].create({'name': 'RESP East'})
        self.job_title = self.env['school.job.title'].create({
            'name': 'RESP Classroom Teacher', 'department': 'academic',
        })
        self.admin_job_title = self.env['school.job.title'].create({
            'name': 'RESP Registrar', 'department': 'administration',
        })
        self.class_a = self.env['school.class'].create({
            'name': 'RESP Grade 1', 'section': 'A', 'academic_year': YEAR, 'is_entry_level': True,
        })
        self.maths = self.env['school.subject'].create({'name': 'RESP Mathematics'})

        self.staff = self._staff('RESP Teacher One', self.campus_main)
        self.teacher = self.env['school.teacher'].create({'staff_id': self.staff.id})

    def _staff(self, name, campus, department='academic'):
        title = self.admin_job_title if department == 'administration' else self.job_title
        parts = name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else 'Staff'
        return self.env['school.staff'].create({
            'first_name': first_name, 'last_name': last_name,
            'department': department, 'job_title_id': title.id,
            'employment_status': 'active', 'phone': '+251911000000', 'campus_id': campus.id,
        })

    def _responsibility(self, staff, code, **overrides):
        vals = {
            'staff_id': staff.id, 'responsibility': code,
            'start_date': '2026-07-01', 'department': 'academic',
        }
        vals.update(overrides)
        return self.env['school.staff.responsibility'].create(vals)

    def _assignment(self, **overrides):
        vals = {
            'teacher_id': self.teacher.id, 'subject_id': self.maths.id,
            'class_id': self.class_a.id, 'term': 'term1',
        }
        vals.update(overrides)
        return self.env['school.teacher.assignment'].create(vals)

    # ---------- section 13: master-record rename propagates ----------

    def test_renaming_staff_renames_the_teacher(self):
        self.assertEqual(self.teacher.name, 'RESP Teacher One')
        self.staff.write({'first_name': 'RESP', 'last_name': 'Teacher Renamed'})
        self.assertEqual(self.teacher.name, 'RESP Teacher Renamed')

    def test_rename_reaches_the_assignment_label(self):
        assignment = self._assignment()
        self.staff.write({'first_name': 'RESP', 'last_name': 'Renamed Again'})
        self.assertIn('RESP Renamed Again', assignment.name)

    # ---------- section 4: control status gates ----------

    def test_staff_cannot_leave_draft_without_a_responsibility(self):
        with self.assertRaises(ValidationError):
            self.staff.action_activate()

    def test_staff_cannot_leave_draft_without_a_phone(self):
        self._responsibility(self.staff, 'teacher', is_primary=True)
        self.staff.phone = False
        with self.assertRaises(ValidationError):
            self.staff.action_activate()

    def test_staff_activates_once_requirements_are_met(self):
        self._responsibility(self.staff, 'teacher', is_primary=True)
        self.staff.action_activate()
        self.assertEqual(self.staff.state, 'active')

    def test_suspended_staff_cannot_take_a_new_assignment(self):
        self._responsibility(self.staff, 'teacher', is_primary=True)
        self.staff.action_activate()
        self.staff.action_suspend()
        with self.assertRaises(ValidationError):
            self._assignment()

    def test_deactivating_staff_disables_the_linked_login(self):
        user = self.env['res.users'].create({'name': 'RESP User', 'login': 'resp_user'})
        self.staff.user_id = user.id
        self._responsibility(self.staff, 'teacher', is_primary=True)
        self.staff.action_activate()
        self.staff.action_deactivate()
        self.assertFalse(user.active)
        self.assertEqual(self.staff.state, 'inactive')

    # ---------- section 6: responsibility rules ----------

    def test_only_one_primary_responsibility_per_staff(self):
        self._responsibility(self.staff, 'teacher', is_primary=True)
        with self.assertRaises(ValidationError):
            self._responsibility(self.staff, 'librarian', is_primary=True)

    def test_primary_responsibility_surfaces_on_the_staff_record(self):
        self._responsibility(self.staff, 'homeroom', is_primary=True)
        self.assertEqual(self.staff.primary_responsibility, 'homeroom')

    def test_staff_cannot_report_to_themselves(self):
        with self.assertRaises(ValidationError):
            self._responsibility(self.staff, 'teacher', manager_id=self.staff.id)

    def test_only_one_homeroom_teacher_per_class_and_term(self):
        self._responsibility(self.staff, 'teacher', is_primary=True)
        self.staff.action_activate()
        self._assignment(responsibility='homeroom')

        other_staff = self._staff('RESP Teacher Two', self.campus_main)
        self._responsibility(other_staff, 'teacher', is_primary=True)
        other_staff.action_activate()
        other_teacher = self.env['school.teacher'].create({'staff_id': other_staff.id})
        history = self.env['school.subject'].create({'name': 'RESP History'})
        with self.assertRaises(ValidationError):
            self._assignment(
                teacher_id=other_teacher.id, subject_id=history.id, responsibility='homeroom',
            )

    # ---------- section 8: audiences that only staff records can satisfy ----------

    def _user_for(self, staff, login, group):
        user = self.env['res.users'].create({
            'name': login, 'login': login,
            'groups_id': [(6, 0, [
                self.env.ref('base.group_user').id,
                self.env.ref(f'school_management.{group}').id,
            ])],
        })
        staff.user_id = user.id
        return user

    def _announcement(self, name, **overrides):
        vals = {'name': name, 'message': '<p>body</p>', 'audience_type': 'all_staff'}
        vals.update(overrides)
        record = self.env['school.announcement'].create(vals)
        record.action_publish()
        return record

    def test_registrar_sees_responsibility_targeted_announcement(self):
        registrar_staff = self._staff('RESP Registrar', self.campus_main, 'administration')
        self._responsibility(
            registrar_staff, 'registrar', is_primary=True, department='administration',
        )
        user = self._user_for(registrar_staff, 'resp_registrar', 'group_school_registrar')

        targeted = self._announcement(
            'RESP For Registrars', audience_type='responsibility', responsibility='registrar',
        )
        other = self._announcement(
            'RESP For Librarians', audience_type='responsibility', responsibility='librarian',
        )
        visible = self.env['school.announcement'].with_user(user).search([])
        self.assertIn(targeted, visible)
        self.assertNotIn(other, visible)

    def test_campus_targeted_announcement_respects_the_staff_campus(self):
        east_staff = self._staff('RESP East Staff', self.campus_east)
        self._responsibility(east_staff, 'librarian', is_primary=True, campus_id=self.campus_east.id)
        user = self._user_for(east_staff, 'resp_east', 'group_school_frontoffice')

        mine = self._announcement(
            'RESP East Notice', audience_type='branch_campus',
            campus_ids=[(6, 0, self.campus_east.ids)],
        )
        theirs = self._announcement(
            'RESP Main Notice', audience_type='branch_campus',
            campus_ids=[(6, 0, self.campus_main.ids)],
        )
        visible = self.env['school.announcement'].with_user(user).search([])
        self.assertIn(mine, visible)
        self.assertNotIn(theirs, visible)

    # ---------- teacher profile linkage & status sync ----------

    def test_teacher_profile_requires_active_staff(self):
        draft_staff = self._staff('RESP Draft Staff', self.campus_main)
        with self.assertRaises(ValidationError):
            self.env['school.teacher'].create({'staff_id': draft_staff.id})

    def test_deactivating_staff_inactivates_teacher_profile(self):
        self._responsibility(self.staff, 'teacher', is_primary=True)
        self.staff.action_activate()
        self.assertEqual(self.teacher.teaching_status, 'active')

        self.staff.action_suspend()
        self.assertEqual(self.teacher.teaching_status, 'inactive')

        self.staff.action_activate()
        self.assertEqual(self.teacher.teaching_status, 'active')

        self.staff.action_deactivate()
        self.assertEqual(self.teacher.teaching_status, 'inactive')

    def test_duplicate_teacher_profile_rejected(self):
        self._responsibility(self.staff, 'teacher', is_primary=True)
        self.staff.action_activate()
        with self.assertRaises(Exception):
            self.env['school.teacher'].create({'staff_id': self.staff.id})
