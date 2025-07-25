from flask import Flask, request, jsonify, send_file
from PIL import Image, ImageOps
import pytesseract
import re
import io
import base64
from pdf2image import convert_from_bytes
from io import BytesIO
from pyzbar.pyzbar import decode
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

app = Flask(__name__)

# === Image Scaling Only ===
def scale_image(image, scale_factor=2):
    new_size = (int(image.width * scale_factor), int(image.height * scale_factor))
    return image.resize(new_size, Image.LANCZOS)

# === Existing Functions (Unchanged) ===
def fix_grade_format(value):
    value = value.strip()
    if re.fullmatch(r"\d{3}", value):  # e.g., 250 → 2.50
        return f"{value[0]}.{value[1:]}"
    return value

def fix_course_code(raw_code, raw_number):
    prefix = raw_code.upper().strip()
    number = raw_number.strip()
    return f"{prefix}{number}"

def extract_course_grade_only(lines):
    course_codes = []
    grades = []
    skipped_lines = []

    for line in lines:
        tokens = line.strip().split()

        # Must start with row number
        if not tokens or not tokens[0].isdigit():
            skipped_lines.append(f"[SKIPPED: No starting row number] {line}")
            continue

        # Find course code: 2 tokens like BAT 401, IT 311, etc.
        course_code = ""
        for i in range(1, len(tokens) - 1):
            if re.match(r'^[A-Za-z]{2,6}$', tokens[i]) and re.match(r'^\d{3}$', tokens[i + 1]):
                course_code = tokens[i] + tokens[i + 1]
                break

        if not course_code:
            skipped_lines.append(f"[SKIPPED: Course code not found] {line}")
            continue

        # Find grade: decimal like 1.00, 2.50, etc. — usually last decimal after unit
        decimal_grades = [token for token in tokens if re.fullmatch(r"\d\.\d{2}", token)]
        if not decimal_grades:
            skipped_lines.append(f"[SKIPPED: Grade not found] {line}")
            continue

        grade = decimal_grades[0]  # take the first decimal after the unit

        course_codes.append(course_code)
        grades.append(grade)

    # Format output
    result = "CourseCode{\n" + "\n".join(course_codes) + "\n};\n\n"
    result += "Grade{\n" + "\n".join(grades) + "\n};\n"

    return result, skipped_lines


def extract_metadata(lines):
    sr_code = sex = name = program = ""
    for line in lines:
        line = line.strip()
        if not sr_code and "SR Code" in line:
            match = re.search(r"SR Code:?\s*([\d\-]+)", line)
            if match:
                sr_code = match.group(1)
        if not sex and "Sex" in line:
            match = re.search(r"Sex:?\s*([A-Z]+)", line)
            if match:
                sex = match.group(1)
        if not name and "Name" in line:
            match = re.search(r"Name:?\s*([A-Z ,']+\s+[A-Z0]\.?)", line)
            if match:
                name = match.group(1).strip()
                name = re.sub(r"([A-Z])0", r"\1O", name)
                if not name.endswith("."):
                    name += "."
        if not program and "Program" in line:
            match = re.search(r"Program:?\s*([^\n\r]*)", line)
            if match:
                program = match.group(1)
                for w in ['Free Tuition', 'Discount', 'Fee', 'Assessment', 'Medical', 'Dental', 'Security']:
                    if w in program:
                        program = program.split(w)[0].strip()
    return sr_code, sex, name, program

def extract_course_data(line):
    line = re.sub(r"\s+", " ", line).strip()

    if not re.search(r"\b([A-Za-z]{2,5})[- ]?(\d{3})\b", line):
        return None

    match = re.search(r"\b([A-Za-z]{2,5})[- ]?(\d{3})\b", line)
    if not match:
        return None

    prefix = match.group(1).upper()
    code = f"{prefix} {match.group(2)}"

    blacklist_prefixes = {"FEE", "NSTP", "SCUAA", "ANTI", "INS", "HEMF", "TOTAL", "DISCOUNT"}
    if prefix in blacklist_prefixes:
        return None

    finance_words = ["fee", "discount", "php", ".00", "tuition", "insurance", "assessment"]
    if all(word in line.lower() for word in finance_words):
        return None

    return code

def process_ocr_text(raw_text):
    lines = raw_text.splitlines()
    sr_code, sex, name, program = extract_metadata(lines)
    course_codes = []

    for line in lines:
        res = extract_course_data(line)
        if res:
            print(f"✅ Parsed course code: {res}")
            course_codes.append(res)
        else:
            print(f"⛔ Skipped: {line}")

    result = f"SR Code: {sr_code}\nSex: {sex}\nName: {name}\nProgram: {program}\n\n"
    result += "COURSE CODE{\n" + ",\n".join(course_codes) + ",\n}"
    return result

# === Flask Routes ===
@app.route('/upload_registration_summary', methods=['POST'])
def upload_registration_summary():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files['image']
    image = Image.open(image_file.stream)
    cropped_image = image.crop((100, 580, 1300, 1500))

    scaled_image = scale_image(cropped_image, scale_factor=2)
    raw_text = pytesseract.image_to_string(scaled_image)
    result = process_ocr_text(raw_text)

    with open("result_certificate_of_enrollment.txt", "w", encoding="utf-8") as f:
        f.write(result)

    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    return jsonify({
        "result": result,
        "image": f"data:image/png;base64,{img_base64}"
    })

@app.route('/upload_registration_summary_pdf', methods=['POST'])
def upload_registration_summary_pdf():
    if 'pdf' not in request.files:
        return jsonify({"error": "No PDF uploaded"}), 400

    pdf_file = request.files['pdf']
    pdf_bytes = pdf_file.read()

    try:
        images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, poppler_path=r"C:\poppler-24.08.0\Library\bin")
    except Exception as e:
        return jsonify({"error": f"PDF conversion failed: {str(e)}"}), 500

    if not images:
        return jsonify({"error": "No image generated from PDF"}), 400

    scaled_image = scale_image(images[0], scale_factor=2)
    raw_text = pytesseract.image_to_string(scaled_image)
    result = process_ocr_text(raw_text)

    with open("result_certificate_of_enrollment.txt", "w", encoding="utf-8") as f:
        f.write(result)

    return jsonify({"result": result})

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files['image']
    image = Image.open(image_file.stream)

    image = image.resize((image.width * 3, image.height * 3))
    qr_result = decode(image)

    if not qr_result:
        return jsonify({"error": "No QR code detected"}), 400

    qr_data = qr_result[0].data.decode('utf-8')
    if not qr_data.startswith('http'):
        return jsonify({"error": "QR code does not contain a valid URL"}), 400

    try:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_window_size(1280, 800)
        driver.get(qr_data)
        time.sleep(3)

        screenshot_path = "qr_website_screenshot.png"
        driver.save_screenshot(screenshot_path)
        driver.quit()

        screenshot = Image.open(screenshot_path)
        scaled_image = scale_image(screenshot, scale_factor=2)
        raw_text = pytesseract.image_to_string(scaled_image)

        with open("raw_ocr_text.txt", "w", encoding="utf-8") as f:
            f.write(raw_text)

        lines = raw_text.splitlines()
        filtered_lines = [line.strip() for line in lines if line.strip() and not re.fullmatch(r"[#,\]\|\“”=()\-_. ]+", line)]
        grouped_result, skipped = extract_course_grade_only(filtered_lines)
        with open("parsed_course_grade_result.txt", "w", encoding="utf-8") as f:
            f.write(grouped_result)

        return jsonify({
            "mode": "qr + ocr + parse",
            "qr_url": qr_data,
            "extracted_count": len(filtered_lines),
            "grouped_result": grouped_result,
            "skipped_count": len(skipped),
            "skipped_lines": skipped[:10],
            "ocr_preview": raw_text[:500]
        })

    except Exception as e:
        return jsonify({"error": f"Failed to process: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
