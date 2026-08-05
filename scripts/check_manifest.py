from pathlib import Path
import ast


REQUIRED_FIELDS = [
    "name",
    "version",
    "depends",
    "data",
]


def check_manifest():
    issues = []

    manifests = Path(".").rglob("__manifest__.py")

    for manifest in manifests:
        try:
            with open(manifest, "r", encoding="utf-8") as file:
                content = file.read().strip()

                # Ignore empty placeholder files
                if not content:
                    continue

                manifest_data = ast.literal_eval(content)

            for field in REQUIRED_FIELDS:
                if field not in manifest_data:
                    issues.append(
                        {
                            "severity": "HIGH",
                            "file": str(manifest),
                            "message": f"Missing '{field}' in manifest.",
                            "solution": f"Add the '{field}' field to __manifest__.py",
                        }
                    )

        except Exception as e:
            issues.append(
                {
                    "severity": "CRITICAL",
                    "file": str(manifest),
                    "message": str(e),
                    "solution": "Fix the manifest syntax.",
                }
            )

    return issues