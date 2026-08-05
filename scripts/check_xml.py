from pathlib import Path
import xml.etree.ElementTree as ET


def check_xml():

    issues = []

    xml_files = Path(".").rglob("*.xml")

    found_xml = False

    for xml_file in xml_files:

        found_xml = True

        try:
            ET.parse(xml_file)

        except ET.ParseError as e:

            issues.append(
                {
                    "severity": "CRITICAL",
                    "file": str(xml_file),
                    "message": str(e),
                    "solution": "Fix XML syntax errors.",
                }
            )

    if not found_xml:
        issues.append(
            {
                "severity": "LOW",
                "file": "views/",
                "message": "No XML files found.",
                "solution": "Add Odoo XML views or data files.",
            }
        )

    return issues