import pytesseract
from PIL import Image
import re

# Helper: Fix malformed grades/units like 175 → 1.75
def fix_grade_format(value):
    if re.fullmatch(r"\d{3}", value):
        return f"{value[0]}.{value[1:]}"
    return value

def group_by_column(lines):
    course_codes = []
    titles = []
    units = []
    grades = []
    sections = []
    instructors = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # More flexible regex: allows lowercase, trailing comma, 3-digit grades
        match = re.match(
            r'^(\d+)?\s*([A-Za-z]{2,4}\s*\d{3}),?\s+(.*?)\s+(\d{1,3}(?:\.\d{1,2})?)\s+(\d{1,3}(?:\.\d{1,2})?)\s+(IT-BA-\d{4})\s+(.*)',
            line,
            flags=re.IGNORECASE
        )

        if not match:
            print(f"⚠️ Skipped: {line}")
            continue

        index, code, title, unit, grade, section, instructor = match.groups()

        course_codes.append(code.replace(",", "").upper())
        titles.append(title)
        units.append(fix_grade_format(unit))
        grades.append(fix_grade_format(grade))
        sections.append(section)
        instructors.append(instructor)

    result = ""
    for name, values in zip(
        ["CourseCode", "CourseTitle", "Units", "Grade", "Section", "Instructor"],
        [course_codes, titles, units, grades, sections, instructors]
    ):
        result += f"{name}{{\n"
        for v in values:
            result += f"{v},\n"
        result += "};\n\n"

    return result

# === MAIN SCRIPT ===

# 1. Load image
image = Image.open("test_image.png")

# 2. OCR text
raw_text = pytesseract.image_to_string(image)

# 3. Remove noise / irrelevant info
ignore_phrases = [
    "BATANGAS STATE UNIVERSITY", "ARASOF-Nasugbu Campus",
    "Student's Copy of Grades", "Fullname", "College", "Program",
    "SRCODE", "Academic Year", "Semester", "Year Level",
    "NOTHING FOLLOWS", "**", "]" "©"
]

filtered_lines = []
for line in raw_text.splitlines():
    line = line.strip()
    if not line:
        continue
    if any(phrase in line for phrase in ignore_phrases):
        continue
    if re.search(r"\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2} [AP]M", line):
        continue
    if re.search(r"\(?\d{2}-\d{5,6}\)?", line):
        continue
    if re.fullmatch(r"[#,\]\|\“”=()\-_. ]+", line):
        continue
    filtered_lines.append(line)

# 4. Group + Save
grouped_text = group_by_column(filtered_lines)

with open("output.txt", "w", encoding="utf-8") as f:
    f.write(grouped_text)

print("✅ Done. Grouped column data saved to 'output.txt':\n")
print(grouped_text)
