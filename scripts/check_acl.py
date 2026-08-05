from pathlib import Path
import csv


def check_acl():
    issues = []

    acl_files = Path(".").rglob("ir.model.access.csv")

    found_acl = False

    for acl_file in acl_files:
        found_acl = True

        try:
            with open(
                acl_file,
                "r",
                encoding="utf-8"
            ) as file:

                reader = csv.DictReader(file)

                for row in reader:

                    model = row.get("model_id:id")
                    permissions = [
                        row.get("perm_read"),
                        row.get("perm_write"),
                        row.get("perm_create"),
                        row.get("perm_unlink"),
                    ]

                    if not any(
                        permissions
                    ):
                        issues.append(
                            {
                                "severity": "HIGH",
                                "file": str(acl_file),
                                "message": f"{model} has no permissions enabled.",
                                "solution": "Enable at least one ACL permission.",
                            }
                        )

        except Exception as e:
            issues.append(
                {
                    "severity": "CRITICAL",
                    "file": str(acl_file),
                    "message": str(e),
                    "solution": "Fix ACL CSV format.",
                }
            )

    if not found_acl:
        issues.append(
            {
                "severity": "CRITICAL",
                "file": "security/",
                "message": "No ir.model.access.csv found.",
                "solution": "Create ACL rules for your models.",
            }
        )

    return issues