from odoo import fields, models

# HR/Registrar and above. Field-level groups keep the binaries out of every other
# role's read access, including the form view and the ORM.
PRIVATE = 'school_management.group_school_registrar'


class SchoolStaffDocuments(models.Model):
    _inherit = 'school.staff'

    id_document = fields.Binary(string='ID Document', attachment=True, groups=PRIVATE)
    id_document_filename = fields.Char(string='ID Document Filename', groups=PRIVATE)
    qualification_document = fields.Binary(
        string='Qualification / Certificate', attachment=True, groups=PRIVATE,
    )
    qualification_document_filename = fields.Char(
        string='Qualification Filename', groups=PRIVATE,
    )
    employment_contract = fields.Binary(
        string='Employment Contract', attachment=True, groups=PRIVATE,
    )
    employment_contract_filename = fields.Char(
        string='Employment Contract Filename', groups=PRIVATE,
    )


class SchoolTeacherDocuments(models.Model):
    _inherit = 'school.teacher'

    qualification_document = fields.Binary(
        string='Qualification Document', attachment=True, groups=PRIVATE,
    )
    qualification_document_filename = fields.Char(
        string='Qualification Filename', groups=PRIVATE,
    )
    employment_document = fields.Binary(
        string='Employment Document', attachment=True, groups=PRIVATE,
    )
    employment_document_filename = fields.Char(
        string='Employment Document Filename', groups=PRIVATE,
    )
