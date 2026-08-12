from odoo.tests.common import TransactionCase


class TestOdoo19UiAccess(TransactionCase):
    """Regression coverage for master-data creation and Odoo 19 form rendering."""

    def test_school_administrator_and_registrar_can_create_master_data(self):
        registrar = self.env['res.users'].create({
            'name': 'UI Access Registrar', 'login': 'ui_access_registrar',
            'group_ids': [(6, 0, [
                self.env.ref('base.group_user').id,
                self.env.ref('school_management.group_school_registrar').id,
            ])],
        })
        for model_name in (
            'school.academic.year', 'school.term', 'school.section',
            'school.class', 'school.subject', 'school.grade.subject',
            'school.teacher', 'school.teacher.assignment',
        ):
            for user in (self.env.ref('base.user_admin'), registrar):
                with self.subTest(model=model_name, user=user.login):
                    self.assertTrue(
                        self.env[model_name].with_user(user).has_access('create'),
                        '%s must be creatable from its administrator/registrar menu'
                        % model_name,
                    )

    def test_mail_thread_forms_use_odoo19_chatter_element(self):
        for xml_id in (
            'view_school_assessment_form', 'view_school_enrollment_form',
            'view_school_teacher_assignment_form', 'view_school_announcement_form',
            'view_school_class_schedule_form', 'view_school_program_form',
            'view_school_staff_responsibility_form',
        ):
            with self.subTest(view=xml_id):
                arch = self.env.ref('school_management.%s' % xml_id).arch_db
                self.assertNotIn('oe_chatter', arch)
                self.assertNotIn('message_follower_ids', arch)
                self.assertNotIn('message_ids', arch)
                self.assertIn('<chatter', arch)

    def test_dependent_academic_pickers_are_scoped(self):
        expected_fragments = {
            'view_school_student_form': [
                "('academic_year_id', '=', academic_year_id)"],
            'view_school_assessment_form': [
                "('grade_subject_ids.class_id', '=', class_id)",
                "('academic_year_id', '=', academic_year_id)",
                'teacher_assignment_id'],
            'view_school_teacher_assignment_form': [
                "('grade_subject_ids.class_id', '=', class_id)",
                "('academic_year_id', '=', academic_year_id)"],
            'view_school_class_schedule_form': [
                "('grade_subject_ids.class_id', '=', class_id)",
                "('academic_year_id', '=', academic_year_id)",
                'teacher_assignment_id'],
            'view_school_enrollment_transfer_form': [
                "('academic_year_id', '=', academic_year_id)"],
        }
        for xml_id, fragments in expected_fragments.items():
            arch = self.env.ref('school_management.%s' % xml_id).arch_db
            for fragment in fragments:
                with self.subTest(view=xml_id, fragment=fragment):
                    self.assertIn(fragment, arch)

    def test_marks_are_generated_roster_rows_not_manual_records(self):
        for xml_id in ('view_school_mark_tree', 'view_school_mark_form'):
            arch = self.env.ref('school_management.%s' % xml_id).arch_db
            with self.subTest(view=xml_id):
                self.assertIn('create="0"', arch)
                self.assertIn('delete="0"', arch)

    def test_mark_entry_opens_the_assessment_workflow(self):
        action = self.env.ref('school_management.action_school_my_mark_tasks')
        self.assertEqual(action.res_model, 'school.assessment')
        self.assertEqual(action.view_mode, 'list,form')
