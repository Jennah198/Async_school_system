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
