from check_acl import check_acl
from check_xml import check_xml
from check_manifest import check_manifest
from check_secrets import check_secrets


def run_audit():

    results = []

    results += check_acl()
    results += check_xml()
    results += check_manifest()
    results += check_secrets()


    generate_report(results)



def generate_report(results):

    with open(
        "reports/audit_report.md",
        "w"
    ) as file:

        file.write("# Odoo Audit Report\n\n")

        for issue in results:
            file.write(
                f"""
## {issue['severity']}

File:
{issue['file']}

Problem:
{issue['message']}

Fix:
{issue['solution']}

---
"""
            )


if __name__ == "__main__":
    run_audit()
