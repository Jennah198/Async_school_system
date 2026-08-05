from pathlib import Path
import re


SECRET_PATTERNS = [
    r"password\s*=\s*['\"].+['\"]",
    r"secret\s*=\s*['\"].+['\"]",
    r"api[_-]?key\s*=\s*['\"].+['\"]",
    r"token\s*=\s*['\"].+['\"]",
]


def check_secrets():

    issues = []

    files = Path(".").rglob("*")

    for file in files:

        if (
            file.is_file()
            and ".git" not in str(file)
            and file.suffix in [
                ".py",
                ".xml",
                ".csv",
                ".yml",
                ".yaml",
                ".conf",
            ]
        ):

            try:
                content = file.read_text(
                    encoding="utf-8",
                    errors="ignore"
                )

                for pattern in SECRET_PATTERNS:

                    if re.search(
                        pattern,
                        content,
                        re.IGNORECASE
                    ):
                        issues.append(
                            {
                                "severity": "CRITICAL",
                                "file": str(file),
                                "message": "Possible secret detected.",
                                "solution": "Remove credentials and use environment variables.",
                            }
                        )

            except Exception:
                pass

    return issues