from flask import Flask, request, jsonify, send_from_directory
from PIL import Image
import pytesseract
import re
import io
from pdf2image import convert_from_bytes
from pyzbar.pyzbar import decode
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
from reportlab.lib.pagesizes import letter
from pdfrw import PdfReader, PdfWriter, PageMerge
from reportlab.pdfgen import canvas
import os

app = Flask(__name__)

# === Paths ===
BASE_DIR = os.path.dirname(__file__)
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)  # ensure results/ exists

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

    blacklist_prefixes = {"FEE", "SCUAA", "ANTI", "INS", "HEMF", "TOTAL", "DISCOUNT"}
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

# ---------- Cross-check helpers ----------
SEMESTER_MAP = {
    "FIRST": "1st", "1ST": "1st", "1": "1st",
    "SECOND": "2nd", "2ND": "2nd", "2": "2nd",
    "MIDYEAR": "midyear", "MID-YEAR": "midyear", "MID YEAR": "midyear",
    "SUMMER": "summer"
}
YEARLEVEL_MAP = {
    "FIRST": "1", "1ST": "1", "1": "1",
    "SECOND": "2", "2ND": "2", "2": "2",
    "THIRD": "3", "3RD": "3", "3": "3",
    "FOURTH": "4", "4TH": "4", "4": "4"
}

def _digits_only(s: str) -> str:
    return re.sub(r"\D+", "", s or "")

def _norm_sr_code(s: str) -> str:
    return _digits_only(s)

def _norm_acad_year(s: str) -> str:
    m = re.search(r"(20\d{2})\s*[-/–]\s*(20\d{2})", s or "", flags=re.I)
    if not m:
        return ""
    a, b = m.group(1), m.group(2)
    return f"{a}-{b}"

def _norm_semester_token(tok: str) -> str:
    up = (tok or "").upper()
    if "MID" in up and "YEAR" in up:
        return "midyear"
    for k, v in SEMESTER_MAP.items():
        if re.fullmatch(k, up):
            return v
    return SEMESTER_MAP.get(up, "")

def _norm_semester(s: str) -> str:
    up = (s or "").upper()
    if "MID" in up and "YEAR" in up:
        return "midyear"
    # FIRST / SECOND / 1ST / 2ND / SUMMER
    m = re.search(r"\b(FIRST|SECOND|1ST|2ND|MID[- ]?YEAR|SUMMER)\b", up)
    if m:
        return _norm_semester_token(m.group(1))
    # "1st Semester"
    m = re.search(r"\b(1ST|2ND)\s+SEM(ESTER)?\b", up)
    if m:
        return _norm_semester_token(m.group(1))
    return ""

def _norm_year_level(s: str) -> str:
    up = (s or "").upper()
    m = re.search(r"\b(FIRST|SECOND|THIRD|FOURTH|1ST|2ND|3RD|4TH|[1-4])\b", up)
    if not m:
        return ""
    tok = m.group(1)
    return YEARLEVEL_MAP.get(tok, tok if tok in {"1", "2", "3", "4"} else "")

def parse_from_coe(raw_text: str) -> dict:
    """
    raw_certificate_of_enrollment.txt structure (sample):
      'SECOND, 2024-2025'
      'SR Code: 22-73105'
      'Bachelor of Secondary Education -ENG/THIRD'
    """
    txt = raw_text or ""

    # Semester + AY often on one line: 'SECOND, 2024-2025'
    sem = ""
    ay = ""
    m = re.search(
        r"\b(FIRST|SECOND|1ST|2ND|MID[- ]?YEAR|SUMMER)\b\s*[, ]+\s*(20\d{2}\s*[-/–]\s*20\d{2})",
        txt, flags=re.I
    )
    if m:
        sem = _norm_semester(m.group(1))
        ay = _norm_acad_year(m.group(2))
    else:
        # fallback: search separately
        ay_m = re.search(r"(20\d{2}\s*[-/–]\s*20\d{2})", txt)
        if ay_m:
            ay = _norm_acad_year(ay_m.group(1))
        sem = _norm_semester(txt)

    # SR Code
    sr = ""
    m = re.search(r"\bSR\s*Code\s*:\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
    if m:
        sr = _norm_sr_code(m.group(1))

    # Year Level — appears like '/THIRD' at the tail of degree line
    yl = ""
    m = re.search(r"/\s*(FIRST|SECOND|THIRD|FOURTH|1ST|2ND|3RD|4TH)\b", txt, flags=re.I)
    if m:
        yl = _norm_year_level(m.group(1))
    else:
        # alternative phrasing
        m = re.search(r"YEAR\s*LEVEL\s*:?\s*(FIRST|SECOND|THIRD|FOURTH|1ST|2ND|3RD|4TH|[1-4])", txt, flags=re.I)
        if m:
            yl = _norm_year_level(m.group(1))

    return {
        "sr_code": sr,
        "academic_year": ay,
        "semester": sem,
        "year_level": yl
    }

def parse_from_cog(raw_text: str) -> dict:
    """
    raw_cog_text.txt structure (sample):
      'SRCODE : 22-77832'
      'Academic Year : 2022-2023'
      'Semester : FIRST'
      'Year Level : FIRST'
    """
    txt = raw_text or ""

    sr = ""
    m = re.search(r"\bSR\s*CODE\s*:\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
    if not m:
        m = re.search(r"\bSRCODE\s*:\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
    if m:
        sr = _norm_sr_code(m.group(1))

    ay = ""
    m = re.search(r"\bAcademic\s*Year\s*:\s*(20\d{2}\s*[-/–]\s*20\d{2})", txt, flags=re.I)
    if m:
        ay = _norm_acad_year(m.group(1))

    sem = ""
    m = re.search(r"\bSemester\s*:\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
    if m:
        sem = _norm_semester(m.group(1))

    yl = ""
    m = re.search(r"\bYear\s*Level\s*:\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
    if m:
        yl = _norm_year_level(m.group(1))

    return {
        "sr_code": sr,
        "academic_year": ay,
        "semester": sem,
        "year_level": yl
    }

def compare_fields(a: dict, b: dict) -> dict:
    keys = ["sr_code", "academic_year", "semester", "year_level"]
    matches = {k: (a.get(k, "") == b.get(k, "")) for k in keys}
    all_match = all(matches.values())
    return {"matches": matches, "all_match": all_match}

# === Serve results/ files so RN <Image> can load the cropped preview ===
@app.route('/results/<path:filename>')
def serve_results(filename):
    return send_from_directory(RESULTS_DIR, filename, as_attachment=False)

# === Flask Routes ===
@app.route('/upload_registration_summary_pdf', methods=['POST'])
def upload_registration_summary_pdf():
    if 'pdf' not in request.files:
        return jsonify({"error": "No PDF uploaded"}), 400

    pdf_file = request.files['pdf']
    pdf_bytes = pdf_file.read()

    try:
        images = convert_from_bytes(
            pdf_bytes,
            first_page=1,
            last_page=1,
            poppler_path=r"C:\poppler-24.08.0\Library\bin"  # adjust for your environment
        )
    except Exception as e:
        return jsonify({"error": f"PDF conversion failed: {str(e)}"}), 500

    if not images:
        return jsonify({"error": "No image generated from PDF"}), 400

    original_image = images[0]

    # 📐 Coordinates for cropping the region (adjusting bottom part)
    width, height = original_image.size
    left = 0
    top = 0
    right = width
    bottom = int(height * 0.60)  # keep top 60%

    cropped_image = original_image.crop((left, top, right, bottom))

    # 💾 Save the cropped image to /results folder
    cropped_path = os.path.join(RESULTS_DIR, "COR_pdf_image.png")
    cropped_image.save(cropped_path)

    # 🔍 Scale and OCR
    scaled = scale_image(cropped_image, scale_factor=2)
    raw_text = pytesseract.image_to_string(scaled)

    # 💾 Save the raw OCR text to a file
    raw_ocr_path = os.path.join(RESULTS_DIR, "raw_certificate_of_enrollment.txt")
    with open(raw_ocr_path, "w", encoding="utf-8") as f:
        f.write(raw_text)

    # Parse OCR
    parsed_data = process_ocr_text(raw_text)

    # Save parsed OCR result
    ocr_result_path = os.path.join(RESULTS_DIR, "result_certificate_of_enrollment.txt")
    with open(ocr_result_path, "w", encoding="utf-8") as f:
        f.write(parsed_data)

    # Build absolute URL for RN <Image>
    base = request.host_url.rstrip('/')
    saved_image_rel = "results/COR_pdf_image.png"
    saved_image_url = f"{base}/{saved_image_rel}"

    # Return the result with saved file paths and preview
    return jsonify({
        "message": "COR top section cropped and processed.",
        "saved_image": saved_image_rel,                     # relative (kept for compatibility)
        "saved_image_url": saved_image_url,                 # absolute (use this in RN)
        "raw_ocr_text_file": "results/raw_certificate_of_enrollment.txt",
        "ocr_text_file": "results/result_certificate_of_enrollment.txt",
        "ocr_preview": parsed_data[:500],
        "result": parsed_data
    })

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
        driver.set_window_size(995, 795)
        driver.get(qr_data)
        time.sleep(3)

        # save inside results/ for consistency
        screenshot_path = os.path.join(RESULTS_DIR, "qr_website_screenshot.png")
        driver.save_screenshot(screenshot_path)
        driver.quit()

        screenshot = Image.open(screenshot_path)
        scaled_image = scale_image(screenshot, scale_factor=2)
        raw_text = pytesseract.image_to_string(scaled_image)

        # Save raw OCR in both names (existing + canonical for validation)
        raw_txt_path = os.path.join(RESULTS_DIR, "raw_ocr_text.txt")
        with open(raw_txt_path, "w", encoding="utf-8") as f:
            f.write(raw_text)

        # NEW: canonical file used by validator
        raw_cog_path = os.path.join(RESULTS_DIR, "raw_cog_text.txt")
        with open(raw_cog_path, "w", encoding="utf-8") as f:
            f.write(raw_text)

        lines = raw_text.splitlines()
        filtered_lines = [line.strip() for line in lines if line.strip() and not re.fullmatch(r"[#,\]\|\“”=()\-_. ]+", line)]
        grouped_result, skipped = extract_course_grade_only(filtered_lines)

        parsed_out_path = os.path.join(RESULTS_DIR, "parsed_course_grade_result.txt")
        with open(parsed_out_path, "w", encoding="utf-8") as f:
            f.write(grouped_result)

        return jsonify({
            "mode": "qr + ocr + parse",
            "qr_url": qr_data,
            "saved_image": "results/qr_website_screenshot.png",
            "raw_ocr_text_file": "results/raw_ocr_text.txt",
            "ocr_text_file": "results/parsed_course_grade_result.txt",
            "extracted_count": len(filtered_lines),
            "grouped_result": grouped_result,
            "skipped_count": len(skipped),
            "skipped_lines": skipped[:10],
            "ocr_preview": raw_text[:500],
            "result": grouped_result
        })

    except Exception as e:
        return jsonify({"error": f"Failed to process: {str(e)}"}), 500

# -------- New: Cross-field validation route --------
@app.route('/validate_cross_fields', methods=['GET'])
def validate_cross_fields():
    coe_path = os.path.join(RESULTS_DIR, "raw_certificate_of_enrollment.txt")
    cog_path = os.path.join(RESULTS_DIR, "raw_cog_text.txt")

    if not os.path.exists(coe_path):
        return jsonify({"error": "raw_certificate_of_enrollment.txt not found"}), 400
    if not os.path.exists(cog_path):
        return jsonify({"error": "raw_cog_text.txt not found"}), 400

    with open(coe_path, "r", encoding="utf-8") as f:
        coe_text = f.read()
    with open(cog_path, "r", encoding="utf-8") as f:
        cog_text = f.read()

    coe = parse_from_coe(coe_text)
    cog = parse_from_cog(cog_text)
    verdict = compare_fields(coe, cog)

    return jsonify({
        "coe": coe,
        "cog": cog,
        "verdict": verdict
    })

# Route to Generate PDF with Template and Data
@app.route('/generate_pdf_with_data', methods=['POST'])
def generate_pdf_with_data():
    try:
        # Get data from request
        data = request.json
        name = data.get('name')
        program = data.get('program')

        # Paths to your template and output files
        template_pdf_path = "assets/DL_Template.pdf"  # Assuming it's in assets folder
        output_pdf_path = "generated_application_filled.pdf"

        # Step 1: Prepare the content for the new PDF using ReportLab (overlaying Name and Program)
        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=letter)

        # Set font
        c.setFont("Helvetica", 12)

        # Add the Name and Program at specific (x, y) coordinates (adjust as needed)
        c.drawString(100, 750, f"Name: {name}")  # Example position for Name
        c.drawString(100, 730, f"Program: {program}")  # Example position for Program

        # Save the canvas content into the packet (PDF in-memory)
        c.save()

        # Step 2: Merge the ReportLab-generated content into the existing template PDF
        packet.seek(0)  # Go to the beginning of the packet
        new_pdf = PdfReader(packet)
        existing_pdf = PdfReader(template_pdf_path)
        output_pdf = PdfWriter()

        # Merge content onto the first page of the template
        page = existing_pdf.pages[0]
        merger = PageMerge(page)
        merger.add(new_pdf.pages[0]).render()

        # Step 3: Write to the final PDF output
        output_pdf.addpage(page)
        output_pdf.write(output_pdf_path)

        # Step 4: Return response with the path of the generated PDF
        return jsonify({
            "message": "PDF generated successfully",
            "pdf_url": output_pdf_path
        })

    except Exception as e:
        return jsonify({"error": f"Failed to generate PDF: {str(e)}"}), 500

if __name__ == '__main__':
    # Tip: set TESSDATA_PREFIX / poppler path per env as needed.
    app.run(host="0.0.0.0", port=5000, debug=True)
