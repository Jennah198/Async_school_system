# -*- coding: utf-8 -*-
{
    'name': "School Management",

    'summary': "Student Registration, Staff Registration, Attendance, and Mark List for Async Tech Solutions",

    'description': """
School Management System
=========================
Manages student and staff registration as master data sources, with linked
attendance tracking and mark/result entry referencing the same student record.
    """,

    'author': "Async Tech Solutions",
    'website': "https://www.asynctechsolutions.com",

    'category': 'Education',
    'version': '0.1',

    'depends': ['base', 'mail'],

    'data': [
        'security/school_security.xml',
        'security/ir.model.access.csv',
        'data/school_sequence.xml',
        'data/school_staff_sequence.xml',
        'data/school_job_title_seed_data.xml',
        'data/school_teacher_sequence.xml',
        'data/school_class_seed_data.xml',
        'views/school_class_views.xml',
        'views/school_subject_views.xml',
        'views/school_teacher_views.xml',
        'views/school_student_views.xml',
        'views/school_staff_views.xml',
        'views/school_attendance_views.xml',
        'views/school_mark_views.xml',
        'views/school_menu_views.xml',
        'report/school_student_report.xml',
    ],

    'demo': [
        'demo/school_demo.xml',
    ],

    # ======================================================= #
   
    # ======================================================= #
    'application': True,  
    'installable': True,
    'auto_install': False,
}