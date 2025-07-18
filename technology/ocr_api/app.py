from flask import Flask, request, jsonify
from PIL import Image
import pytesseract
import re
import io

app = Flask(__name__)

# === Reuse your functions ===
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

        match = re.match(
            r'^(\d+)?\s*([A-Za-z]{2,4}\s*\d{3}),?\s+(.*?)\s+(\d{1,3}(?:\.\d{1,2})?)\s+(\d{1,3}(?:\.\d{1,2})?)\s+(IT-BA-\d{4})\s+(.*)',
            line,
            flags=re.IGNORECASE
        )

        if not match:
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

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files['image']
    image = Image.open(image_file.stream)

    # OCR
    raw_text = pytesseract.image_to_string(image)

    # Clean
    ignore_phrases = [
        "BATANGAS STATE UNIVERSITY", "ARASOF-Nasugbu Campus",
        "Student's Copy of Grades", "Fullname", "College", "Program",
        "SRCODE", "Academic Year", "Semester", "Year Level",
        "NOTHING FOLLOWS", "**", "]",
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

    grouped = group_by_column(filtered_lines)
    return jsonify({"result": grouped})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
