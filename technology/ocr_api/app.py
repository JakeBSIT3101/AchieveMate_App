def parse_grade_for_review(raw_text: str) -> str:
  """
  Parse the raw COG text and return a formatted string for 'grade_for_review'.
  """
  lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
  # Extract header fields
  sr_code = ""
  fullname = ""
  college = ""
  academic_year = ""
  program = ""
  semester = ""
  year_level = ""
  course_lines = []
  total_courses = ""
  total_units = ""
  header_found = False
  for i, line in enumerate(lines):
    if not sr_code:
      m = re.search(r"SRCODE\s*:?\s*([\d\-]+)", line, re.I)
      if m:
        sr_code = m.group(1)
    if not fullname:
      m = re.search(r"Fullname\s*:?\s*([^:]+)", line, re.I)
      if m:
        fullname = m.group(1).strip()
    if not college and "College" in line:
      m = re.search(r"College\s*:?\s*([^:]+)", line, re.I)
      if m:
        college = m.group(1).strip()
    if not academic_year and "Academic Year" in line:
      m = re.search(r"Academic Year\s*:?\s*([\d\-/]+)", line, re.I)
      if m:
        academic_year = m.group(1).strip()
    if not program and "Program" in line:
      m = re.search(r"Program\s*:?\s*([^:]+)", line, re.I)
      if m:
        program = m.group(1).strip()
    if not semester and "Semester" in line:
      m = re.search(r"Semester\s*:?\s*([A-Z]+)", line, re.I)
      if m:
        semester = m.group(1).strip()
    if not year_level and "Year Level" in line:
      m = re.search(r"Year Level\s*:?\s*([A-Z]+)", line, re.I)
      if m:
        year_level = m.group(1).strip()
    if line.startswith("# Course Code"):
      header_found = True
      continue
    if header_found and (re.match(r"^\d+ ", line) or line.startswith("** NOTHING FOLLOWS **")):
      course_lines.append(line)
    if "Total no of Course" in line:
      m = re.search(r"Total no of Course\s*(\d+)", line)
      if m:
        total_courses = m.group(1)
    if "Total no of Units" in line:
      m = re.search(r"Total no of Units\s*(\d+)", line)
      if m:
        total_units = m.group(1)

  # Format output
  out = []
  out.append("BATANGAS STATE UNIVERSITY\n")
  out.append("ARASOF-Nasugbu Campus\n")
  out.append("Student's Copy of Grades\n")
  out.append("General Weighted Average (GWA)\n")
  out.append(f"{sr_code}\n")
  out.append(f"Fullname : {fullname}")
  out.append(f" SRCODE : {sr_code}")
  # Remove 'Academic Year' from college if present
  clean_college = re.sub(r"\s*Academic\s*Year.*$", "", college, flags=re.I).strip()
  out.append(f"\nCollege : {clean_college}")
  out.append(f" Academic Year : {academic_year}")
  # Remove 'Semester' from program if present
  clean_program = re.sub(r"\s*Semester.*$", "", program, flags=re.I).strip()
  out.append(f"\nProgram : {clean_program}")
  out.append(f" Semester : {semester}")
  out.append(f"\nYear Level : {year_level}\n")
  out.append("# Course Code Course Title Units Grade Section Instructor")
  for cl in course_lines:
    out.append(cl)
  out.append("** NOTHING FOLLOWS **")
  out.append(f"Total no of Course {total_courses}")
  out.append(f"Total no of Units {total_units}\n")
  return "\n".join(out)

from flask import Flask, request, jsonify, send_from_directory, Response  # <-- added Response
from PIL import Image, ImageOps  # <-- added ImageOps for inversion
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
import tempfile  # for DPI preprocessing
from datetime import datetime


app = Flask(__name__)

# --- grade_for_review parser and endpoint ---
def parse_grade_for_review(raw_text: str) -> str:
  """
  Parse the raw COG text and return a formatted string for 'grade_for_review'.
  """
  lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
  # Extract header fields
  sr_code = ""
  fullname = ""
  college = ""
  academic_year = ""
  program = ""
  semester = ""
  year_level = ""
  course_lines = []
  total_courses = ""
  total_units = ""
  header_found = False
  for i, line in enumerate(lines):
    if not sr_code:
      m = re.search(r"SRCODE\s*:?\s*([\d\-]+)", line, re.I)
      if m:
        sr_code = m.group(1)
    if not fullname:
      m = re.search(r"Fullname\s*:?\s*([^:]+)", line, re.I)
      if m:
        fullname = m.group(1).strip()
    if not college and "College" in line:
      m = re.search(r"College\s*:?\s*([^:]+)", line, re.I)
      if m:
        college = m.group(1).strip()
    if not academic_year and "Academic Year" in line:
      m = re.search(r"Academic Year\s*:?\s*([\d\-/]+)", line, re.I)
      if m:
        academic_year = m.group(1).strip()
    if not program and "Program" in line:
      m = re.search(r"Program\s*:?\s*([^:]+)", line, re.I)
      if m:
        program = m.group(1).strip()
    if not semester and "Semester" in line:
      m = re.search(r"Semester\s*:?\s*([A-Z]+)", line, re.I)
      if m:
        semester = m.group(1).strip()
    if not year_level and "Year Level" in line:
      m = re.search(r"Year Level\s*:?\s*([A-Z]+)", line, re.I)
      if m:
        year_level = m.group(1).strip()
    if line.startswith("# Course Code"):
      header_found = True
      continue
    if header_found and (re.match(r"^\d+ ", line) or line.startswith("** NOTHING FOLLOWS **")):
      course_lines.append(line)
    if "Total no of Course" in line:
      m = re.search(r"Total no of Course\s*(\d+)", line)
      if m:
        total_courses = m.group(1)
    if "Total no of Units" in line:
      m = re.search(r"Total no of Units\s*(\d+)", line)
      if m:
        total_units = m.group(1)

  # Format output
  out = []
  out.append("BATANGAS STATE UNIVERSITY\n")
  out.append("ARASOF-Nasugbu Campus\n")
  out.append("Student's Copy of Grades\n")
  out.append("General Weighted Average (GWA)\n")
  out.append(f"{sr_code}\n")
  out.append(f"Fullname : {fullname}")
  out.append(f" SRCODE : {sr_code}")
  # Remove 'Academic Year' from college if present
  clean_college = re.sub(r"\s*Academic\s*Year.*$", "", college, flags=re.I).strip()
  out.append(f"\nCollege : {clean_college}")
  out.append(f" Academic Year : {academic_year}")
  # Remove 'Semester' from program if present
  clean_program = re.sub(r"\s*Semester.*$", "", program, flags=re.I).strip()
  out.append(f"\nProgram : {clean_program}")
  out.append(f" Semester : {semester}")
  out.append(f"\nYear Level : {year_level}\n")
  out.append("# Course Code Course Title Units Grade Section Instructor")
  for cl in course_lines:
    out.append(cl)
  out.append("** NOTHING FOLLOWS **")
  out.append(f"Total no of Course {total_courses}")
  out.append(f"Total no of Units {total_units}\n")
  return "\n".join(out)

# --- NEW: Parse Grades and Units, output Weighted Grades table with totals ---
def parse_grade_with_units(raw_text: str) -> str:
    """
    Parse raw COG text and output a table: Grades | Units | Weighted Grades.
    Includes a Total row for Units and Weighted Grades, and Weighted Average.
    Skips NSTP 111 and NSTP 121 from totals and table.
    """
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    table = []
    header_found = False
    total_units = 0
    total_weighted = 0.0
    for line in lines:
        if line.startswith("# Course Code"):
            header_found = True
            continue
        if header_found and re.match(r"^\d+ ", line):
            tokens = line.split()
            units = None
            grade = None
            code_idx = -1
            course_code = None
            for i in range(1, len(tokens) - 1):
                if re.match(r'^[A-Za-z]{2,6}$', tokens[i]) and re.match(r'^\d{3}$', tokens[i + 1]):
                    code_idx = i
                    course_code = f"{tokens[i].upper()} {tokens[i+1]}"
                    break
            # Skip NSTP 111 and NSTP 121
            if course_code in {"NSTP 111", "NSTP 121"}:
                continue
            if code_idx != -1:
                for j in range(code_idx + 2, len(tokens)):
                    if re.match(r"^\d+$", tokens[j]):
                        units = tokens[j]
                        if j + 1 < len(tokens):
                            grade = tokens[j + 1]
                        break
            norm_grade = _normalize_grade_token(grade) if grade else None
            try:
                g_val = float(norm_grade) if norm_grade and norm_grade not in {"INC", "DROP"} else None
                u_val = int(units) if units else None
                weighted = g_val * u_val if g_val is not None and u_val is not None else ""
                if u_val is not None:
                    total_units += u_val
                if weighted != "" and isinstance(weighted, (int, float)):
                    total_weighted += weighted
            except Exception:
                weighted = ""
            table.append([norm_grade or "", units or "", str(weighted) if weighted != "" else ""])
    # Build table string
    out = ["Grades | Units | Weighted Grades |"]
    for row in table:
        out.append(f"{row[0]:<6} | {row[1]:<5} | {row[2]:<14}|")
    # Add totals row
    out.append(f"Total:   | {total_units:<5} | {total_weighted:<14}|")
    # Add Weighted Average row (4 decimal places when numeric)
    if total_units > 0:
        weighted_average = total_weighted / total_units
        weighted_average_str = f"{weighted_average:.4f}"
    else:
        weighted_average_str = ""
    out.append(f"Weighted Average: {weighted_average_str}")
    return "\n".join(out)

# --- Endpoint to serve Grade_with_Units.txt ---
@app.route('/grade_with_units', methods=['GET'])
def grade_with_units():
  raw_cog_path = os.path.join(RESULTS_DIR, "raw_cog_text.txt")
  if not os.path.exists(raw_cog_path):
    return jsonify({"error": "raw_cog_text.txt not found"}), 400
  with open(raw_cog_path, "r", encoding="utf-8") as f:
    raw_text = f.read()
  result = parse_grade_with_units(raw_text)
  # Optionally save to results/Grade_with_Units.txt
  atomic_write_text(os.path.join(RESULTS_DIR, "Grade_with_Units.txt"), result)
  return Response(result, mimetype="text/plain")

# === Paths ===
BASE_DIR = os.path.dirname(__file__)
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)  # ensure results/ exists

# === Canonical result files you are watching ===
RESULT_FILE_COE = os.path.join(RESULTS_DIR, "result_certificate_of_enrollment.txt")
RESULT_FILE_COURSE = os.path.join(RESULTS_DIR, "result_course_grade.txt")

def atomic_write_text(path, text):
  """Write text atomically to avoid partial writes on Windows/Linux."""
  tmp = f"{path}.tmp"
  with open(tmp, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)
    f.flush()
    os.fsync(f.fileno())
  os.replace(tmp, path)

# === Image Scaling Only ===
def scale_image(image, scale_factor=2):
  new_size = (int(image.width * scale_factor), int(image.height * scale_factor))
  return image.resize(new_size, Image.LANCZOS)

# === NEW: Preprocess uploaded image to ~300 DPI and min width 1024 px ===
def set_image_dpi(file_path, min_width_px=1024, dpi=300):
  """
  Loads the image at file_path, ensures minimum width, saves to a temp PNG at 300 DPI,
  and returns the temp filename.
  """
  im = Image.open(file_path)
  width, height = im.size
  factor = max(1.0, float(min_width_px) / float(width))
  new_size = (int(width * factor), int(height * factor))
  im_resized = im.resize(new_size, Image.LANCZOS)

  tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
  tmp_name = tmp.name
  tmp.close()
  im_resized.save(tmp_name, dpi=(dpi, dpi))
  return tmp_name

# ---------------- Grade normalization helpers ----------------
ALLOWED_GRADES = [
  "1.00","1.25","1.50","1.75","2.00","2.25","2.50","2.75","3.00","4.00","5.00","INC"
]
ALLOWED_DECIMALS = [1.00,1.25,1.50,1.75,2.00,2.25,2.50,2.75,3.00,4.00,5.00]
ALLOWED_STR_TO_FLOAT = {s: float(s) for s in ALLOWED_GRADES if re.fullmatch(r"\d\.\d{2}", s)}

def _num_to_grade_string(x: float) -> str:
  if x in (3.0, 4.0, 5.0):
    return str(int(x))
  return f"{x:.2f}"

def _nearest_allowed_decimal(x: float) -> str:
  best = min(ALLOWED_DECIMALS, key=lambda g: abs(g - x))
  return f"{best:.2f}"

def _clean_inc_token(tok: str) -> bool:
  t = tok.upper().replace(" ", "")
  return t in {"INC","IINC","1NC","INc"} or re.fullmatch(r"I[\W_]*N[\W_]*C", tok, flags=re.I) is not None

def _normalize_grade_token(token: str) -> str | None:
  if not token:
    return None
  t = token.strip()

  if _clean_inc_token(t):
    return "INC"


  # Only allow 3.00, 4.00, 5.00 as decimals, not as integers
  # Remove integer match for 3, 4, 5
  # m_int = re.fullmatch(r"([345])(?:\.00)?", t)
  # if m_int:
  #   return m_int.group(1)

  m_three = re.fullmatch(r"(\d)(\d{2})", t)
  if m_three:
    v = f"{m_three.group(1)}.{m_three.group(2)}"
    try:
      x = float(v)
      return _nearest_allowed_decimal(x)
    except:
      pass

  m_dec = re.fullmatch(r"(\d)\.(\d{2})", t)
  if m_dec:
    try:
      x = float(t)
      snapped = _nearest_allowed_decimal(x)
      return snapped
    except:
      pass

  m_weird = re.fullmatch(r"(\d)[,·•:;](\d{2})", t)
  if m_weird:
    try:
      x = float(f"{m_weird.group(1)}.{m_weird.group(2)}")
      return _nearest_allowed_decimal(x)
    except:
      pass

  if "/" in t:
    parts = re.split(r"[\/\\|]", t)
    parts = [p.strip() for p in parts if p.strip()]
    if any(_clean_inc_token(p) for p in parts):
      return "INC"
    for p in parts:
      if re.fullmatch(r"[345](?:\.00)?", p):
        return re.sub(r"\.00$", "", p)

  if t.upper() == "INC":
    return "INC"
  if t in ALLOWED_GRADES:
    return t

  return None

# === Existing Functions (Unchanged-ish) ===
def fix_grade_format(value):
  value = value.strip()
  if re.fullmatch(r"\d{3}", value):
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

    if not tokens or not tokens[0].isdigit():
      skipped_lines.append(f"[SKIPPED: No starting row number] {line}")
      continue

    course_code = ""
    for i in range(1, len(tokens) - 1):
      if re.match(r'^[A-Za-z]{2,6}$', tokens[i]) and re.match(r'^\d{3}$', tokens[i + 1]):
        course_code = tokens[i] + " " + tokens[i + 1]
        break

    if not course_code:
      skipped_lines.append(f"[SKIPPED: Course code not found] {line}")
      continue

    normalized_grade = None
    for tok in reversed(tokens):
      g = _normalize_grade_token(tok)
      if g:
        normalized_grade = g
        break

    if not normalized_grade:
      skipped_lines.append(f"[SKIPPED: Grade not found] {line}")
      continue

    course_codes.append(course_code)
    grades.append(normalized_grade)

  result = "CourseCode{\n" + "\n".join(course_codes) + "\n};\n\n"
  result += "Grade{\n" + "\n".join(grades) + "\n};\n"

  return result, skipped_lines, course_codes, grades

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

def normalize_ocr_noise(s: str) -> str:
  if not s:
    return ""
  t = s.replace("\u2013", "-").replace("\u2014", "-")
  t = t.replace("\u00A0", " ")
  t = t.replace("‘", "'").replace("’", "'")
  t = t.replace("“", '"').replace("”", '"')
  t = re.sub(r"[ \t]+", " ", t)
  t = re.sub(r"\s*,\s*", ", ", t)
  return t

def _norm_acad_year(s: str) -> str:
  m = re.search(
    r"(?:A\.?\s*Y\.?|S\.?\s*Y\.?|Academic\s*Year\s*:?)?\s*(20\d{2})\s*[-/–]\s*(20\d{2})",
    s or "", flags=re.I
  )
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
  m = re.search(r"\b(FIRST|SECOND|1ST|2ND|MID[- ]?YEAR|SUMMER)\b", up)
  if m:
    return _norm_semester_token(m.group(1))
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
  txt = normalize_ocr_noise(raw_text or "")
  sem = ""
  ay  = ""

  m = re.search(
    r"\b(FIRST|SECOND|1ST|2ND|MID[- ]?YEAR|SUMMER)\b\s*[, ]+\s*(?:A\.?\s*Y\.?|S\.?\s*Y\.?)?\s*(20\d{2}\s*[-/–]\s*20\d{2})",
    txt, flags=re.I
  )
  if m:
    sem = _norm_semester(m.group(1))
    ay  = _norm_acad_year(m.group(2))
  else:
    m_sem = re.search(r"\bSemester\s*:?\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
    if m_sem:
      sem = _norm_semester(m_sem.group(1))

    m_ay = re.search(r"(A\.?\s*Y\.?|S\.?\s*Y\.?|Academic\s*Year\s*:?)\s*(20\d{2}\s*[-/–]\s*20\d{2})", txt, flags=re.I)
    if m_ay:
      ay = _norm_acad_year(m_ay.group(2))
    else:
      m_anyay = re.search(r"(20\d{2}\s*[-/–]\s*20\d{2})", txt)
      if m_anyay:
        ay = _norm_acad_year(m_anyay.group(1))

  sr = ""
  m_sr = re.search(r"\bSR\s*Code\s*:\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
  if not m_sr:
    m_sr = re.search(r"\bSRCODE\s*:\s*([A-Za-z0-9\- ]+)", txt, flags=re.I)
  if m_sr:
    sr = _norm_sr_code(m_sr.group(1))

  yl = ""
  m_yl = re.search(r"/\s*(FIRST|SECOND|THIRD|FOURTH|1ST|2ND|3RD|4TH)\b", txt, flags=re.I)
  if m_yl:
    yl = _norm_year_level(m_yl.group(1))
  else:
    m_yl2 = re.search(r"\bYear\s*Level\s*:?\s*(FIRST|SECOND|THIRD|FOURTH|1ST|2ND|3RD|4TH|[1-4])", txt, flags=re.I)
    if m_yl2:
      yl = _norm_year_level(m_yl2.group(1))

  return {
    "sr_code": sr,
    "academic_year": ay,
    "semester": sem,
    "year_level": yl
  }

def parse_from_cog(raw_text: str) -> dict:
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

_YEAR_ORDINAL_MAP = {
  "1": "FIRST", "1ST": "FIRST", "FIRST": "FIRST",
  "2": "SECOND", "2ND": "SECOND", "SECOND": "SECOND",
  "3": "THIRD", "3RD": "THIRD", "THIRD": "THIRD",
  "4": "FOURTH", "4TH": "FOURTH", "FOURTH": "FOURTH",
}
_SEM_WORD_MAP = {
  "1ST": "FIRST", "1": "FIRST", "FIRST": "FIRST",
  "2ND": "SECOND", "2": "SECOND", "SECOND": "SECOND",
  "MIDYEAR": "MIDYEAR", "MID-YEAR": "MIDYEAR", "MID YEAR": "MIDYEAR",
  "SUMMER": "SUMMER"
}

def _normalize_bs_prefix(text: str) -> str:
  t = (text or "").strip()
  m = re.match(r"^\s*B\.?\s*S\.?\s+(.*)$", t, flags=re.I)
  if m:
    return "BS " + m.group(1).strip()
  return t

def split_program_track_year(program_str: str):
  s = (program_str or "").strip()

  year_word = ""
  m_year = re.search(r"/\s*(FIRST|SECOND|THIRD|FOURTH|1ST|2ND|3RD|4TH|[1-4])\s*$", s, flags=re.I)
  if m_year:
    yl_tok = m_year.group(1).upper()
    year_word = _YEAR_ORDINAL_MAP.get(yl_tok, "")
    left = s[:m_year.start()].rstrip()
  else:
    left = s

  left_upper = left.upper()
  has_bs_prefix = bool(re.match(r"^\s*B\.?\s*S\.?\b", left_upper)) or left_upper.startswith("BS ")
  has_bachelor = "BACHELOR" in left_upper

  sep_idx = max(left.rfind('-'), left.rfind('–'))
  if sep_idx != -1 and (has_bs_prefix or has_bachelor):
    base_candidate = left[:sep_idx].strip()
    track_candidate = left[sep_idx + 1:].strip().upper()
    if has_bs_prefix:
      base = _normalize_bs_prefix(base_candidate)
    else:
      base = base_candidate
    track = track_candidate
  else:
    base = _normalize_bs_prefix(left) if has_bs_prefix else left.strip()
    track = ""

  return base, track, year_word

def to_semester_word(sem_val: str) -> str:
  if not sem_val:
    return ""
  up = sem_val.upper()
  if up in {"1ST", "FIRST", "1"}:
    return "FIRST"
  if up in {"2ND", "SECOND", "2"}:
    return "SECOND"
  return _SEM_WORD_MAP.get(up, "")

# === Serve results/ files so RN <Image> can load the cropped preview ===
@app.route('/results/<path:filename>')
def serve_results(filename):
  # Disable caching so fresh files (like grade_image.txt) are always fetched
  resp = send_from_directory(RESULTS_DIR, filename, as_attachment=False)
  try:
    resp.cache_control.no_store = True
    resp.cache_control.max_age = 0
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
  except Exception:
    pass
  return resp

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

  width, height = original_image.size
  left = 0
  top = 0
  right = width
  bottom = int(height * 0.60)

  cropped_image = original_image.crop((left, top, right, bottom))

  cropped_path = os.path.join(RESULTS_DIR, "COR_pdf_image.png")
  cropped_image.save(cropped_path)

  scaled = scale_image(cropped_image, scale_factor=2)
  raw_text = pytesseract.image_to_string(scaled)

  raw_ocr_path = os.path.join(RESULTS_DIR, "raw_certificate_of_enrollment.txt")
  atomic_write_text(raw_ocr_path, raw_text)

  parsed_data = process_ocr_text(raw_text)

  atomic_write_text(RESULT_FILE_COE, parsed_data)

  base = request.host_url.rstrip('/')
  saved_image_rel = "results/COR_pdf_image.png"
  saved_image_url = f"{base}/{saved_image_rel}"

  return jsonify({
    "message": "COR top section cropped and processed.",
    "saved_image": saved_image_rel,
    "saved_image_url": saved_image_url,
    "raw_ocr_text_file": "results/raw_certificate_of_enrollment.txt",
    "ocr_text_file": "results/result_certificate_of_enrollment.txt",
    "ocr_preview": parsed_data[:500],
    "result": parsed_data
  })

# -------------------- OLD image-based upload (kept for compatibility) --------------------
@app.route('/upload', methods=['POST'])
def upload_image():
  if 'image' not in request.files:
    return jsonify({"error": "No image uploaded"}), 400

  image_file = request.files['image']
  try:
    image = Image.open(image_file.stream).convert("RGB")
  except Exception:
    return jsonify({"error": "Unsupported image format"}), 400

  image = image.resize((image.width * 3, image.height * 3))
  qr_result = decode(image)

  if not qr_result:
    return jsonify({"error": "No QR code detected"}), 400

  qr_data = qr_result[0].data.decode('utf-8', errors='ignore')
  if not qr_data.startswith('http'):
    return jsonify({"error": "QR code does not contain a valid URL"}), 400

  driver = None
  try:
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.set_window_size(995, 795)
    driver.get(qr_data)
    time.sleep(3)

    screenshot_path = os.path.join(RESULTS_DIR, "qr_website_screenshot.png")
    driver.save_screenshot(screenshot_path)

    screenshot = Image.open(screenshot_path)
    scaled_image = scale_image(screenshot, scale_factor=2)
    raw_text = pytesseract.image_to_string(scaled_image)

    raw_txt_path = os.path.join(RESULTS_DIR, "raw_ocr_text.txt")
    atomic_write_text(raw_txt_path, raw_text)

    raw_cog_path = os.path.join(RESULTS_DIR, "raw_cog_text.txt")
    atomic_write_text(raw_cog_path, raw_text)

    # --- Update Grade_with_Units.txt after new upload ---
    grade_with_units_path = os.path.join(RESULTS_DIR, "Grade_with_Units.txt")
    grade_with_units_str = parse_grade_with_units(raw_text)
    atomic_write_text(grade_with_units_path, grade_with_units_str)

    lines = raw_text.splitlines()
    filtered_lines = [line.strip() for line in lines if line.strip() and not re.fullmatch(r"[#,\]\|\“”=()\-\_. ]+", line)]
    grouped_result, skipped, _, grades = extract_course_grade_only(filtered_lines)

    legacy_path = os.path.join(RESULTS_DIR, "parsed_course_grade_result.txt")
    atomic_write_text(legacy_path, grouped_result)

    atomic_write_text(RESULT_FILE_COURSE, grouped_result)

    grade_web_path = os.path.join(RESULTS_DIR, "grade_webpage.txt")
    atomic_write_text(grade_web_path, "Grade{\n" + "\n".join(grades) + "\n}\n")

    return jsonify({
      "mode": "qr + ocr + parse",
      "qr_url": qr_data,
      "saved_image": "results/qr_website_screenshot.png",
      "raw_ocr_text_file": "results/raw_ocr_text.txt",
      "ocr_text_file": "results/result_course_grade.txt",
      "grade_webpage_file": "results/grade_webpage.txt",
      "extracted_count": len(filtered_lines),
      "grouped_result": grouped_result,
      "skipped_count": len(skipped),
      "skipped_lines": skipped[:10],
      "ocr_preview": raw_text[:500],
      "result": grouped_result
    })

  except Exception as e:
    return jsonify({"error": f"Failed to process: {str(e)}"}), 500
  finally:
    try:
      if driver:
        driver.quit()
    except:
      pass

# -------------------- NEW PDF-based Step 3 --------------------
@app.route('/upload_grade_pdf', methods=['POST'])
def upload_grade_pdf():
  """
  Step 3: Accept a PDF of the grades.
  - Convert pages to images
  - Detect QR from the PDF pages
  - Visit QR URL (headless) and OCR -> results/grade_webpage.txt
  - OCR the PDF pages themselves -> results/grade_pdf_ocr.txt
  - Also write raw text for cross-field checks -> results/raw_cog_text.txt
  - Return a PNG preview (first page) for the mobile UI
  """
  if 'pdf' not in request.files:
    return jsonify({"error": "No PDF uploaded"}), 400

  pdf_file = request.files['pdf']
  pdf_bytes = pdf_file.read()

  try:
    # Render ALL pages (you can limit to first 1–2 if needed)
    pages = convert_from_bytes(
      pdf_bytes,
      poppler_path=r"C:\poppler-24.08.0\Library\bin"  # adjust per environment
    )
  except Exception as e:
    return jsonify({"error": f"PDF conversion failed: {str(e)}"}), 500

  if not pages:
    return jsonify({"error": "No pages in PDF"}), 400

  # Save preview of page 1 for the app
  preview_png = os.path.join(RESULTS_DIR, "qr_website_screenshot.png")
  pages[0].save(preview_png)

  # ---- 1) Detect QR from PDF pages ----
  qr_data = None
  for im in pages:
    try:
      bigger = scale_image(im, scale_factor=2)
      codes = decode(bigger.convert("RGB"))
      if codes:
        data = codes[0].data.decode('utf-8', errors='ignore')
        if data.startswith('http'):
          qr_data = data
          break
    except Exception:
      pass

  # ---- 2) If QR found, load webpage & OCR for comparison ----
  if qr_data:
    driver = None
    try:
      chrome_options = Options()
      chrome_options.add_argument("--headless=new")
      chrome_options.add_argument("--no-sandbox")
      chrome_options.add_argument("--disable-dev-shm-usage")

      service = Service(ChromeDriverManager().install())
      driver = webdriver.Chrome(service=service, options=chrome_options)
      driver.set_window_size(995, 795)
      driver.get(qr_data)
      time.sleep(3)

      screenshot_path = os.path.join(RESULTS_DIR, "qr_website_screenshot.png")
      driver.save_screenshot(screenshot_path)

      screenshot = Image.open(screenshot_path)
      scaled_image = scale_image(screenshot, scale_factor=2)
      grade_web_txt = pytesseract.image_to_string(scaled_image)

      # Extract grades from webpage OCR and store as block
      lines_web = [ln.strip() for ln in grade_web_txt.splitlines() if ln.strip()]
      grouped_result_web, skipped_web, _, grades_web = extract_course_grade_only(lines_web)
      atomic_write_text(os.path.join(RESULTS_DIR, "grade_webpage.txt"),
                        "Grade{\n" + "\n".join(grades_web) + "\n}\n")
    except Exception:
      # If webpage fails, just write empty -> tamper check will fail (as intended)
      atomic_write_text(os.path.join(RESULTS_DIR, "grade_webpage.txt"), "")
    finally:
      try:
        if driver:
          driver.quit()
      except:
        pass
  else:
    # No QR → create empty webpage grades so tamper check fails (as intended)
    atomic_write_text(os.path.join(RESULTS_DIR, "grade_webpage.txt"), "")

  # ---- 3) OCR the PDF pages themselves ----
  raw_pdf_text_parts = []
  grades_all = []
  for im in pages:
    try:
      bigger = scale_image(im, scale_factor=2)
      raw_txt = pytesseract.image_to_string(bigger)
      raw_pdf_text_parts.append(raw_txt)

      # Parse grades per page
      lines = [ln.strip() for ln in raw_txt.splitlines() if ln.strip()]
      grouped_result, skipped, _, grades = extract_course_grade_only(lines)
      grades_all.extend(grades)
    except Exception:
      continue

  raw_pdf_text = "\n".join(raw_pdf_text_parts)

  raw_cog_path = os.path.join(RESULTS_DIR, "raw_cog_text.txt")
  atomic_write_text(raw_cog_path, raw_pdf_text)

  # --- Update Grade_with_Units.txt after new upload ---
  grade_with_units_path = os.path.join(RESULTS_DIR, "Grade_with_Units.txt")
  grade_with_units_str = parse_grade_with_units(raw_pdf_text)
  atomic_write_text(grade_with_units_path, grade_with_units_str)

  # Save parsed grade block from PDF OCR
  atomic_write_text(os.path.join(RESULTS_DIR, "grade_pdf_ocr.txt"),
                    "Grade{\n" + "\n".join(grades_all) + "\n}\n")

  # Also keep a grouped result file for debugging/consistency
  atomic_write_text(os.path.join(RESULTS_DIR, "result_course_grade.txt"),
                    "Grade{\n" + "\n".join(grades_all) + "\n}\n")

  # --- NEW: After writing raw_cog_text.txt, also write grade_for_review.txt ---
  try:
    with open(raw_cog_path, "r", encoding="utf-8") as f:
      raw_cog_text = f.read()
    grade_for_review_str = parse_grade_for_review(raw_cog_text)
    # Inject Track from raw_certificate_of_enrollment.txt if available
    try:
      coe_path = os.path.join(RESULTS_DIR, "raw_certificate_of_enrollment.txt")
      if os.path.exists(coe_path):
        with open(coe_path, "r", encoding="utf-8") as cf:
          coe_text = cf.read()
        m = re.search(r"-([A-Za-z]{1,10})/", coe_text)
        if m:
          track = m.group(1).upper().strip()
          if track:
            lines = grade_for_review_str.split("\n")
            inserted = False
            for i, ln in enumerate(lines):
              if ln.strip().lower().startswith("year level"):
                lines.insert(i + 1, f"Track : {track}")
                inserted = True
                break
            if not inserted:
              lines.append(f"Track : {track}")
            grade_for_review_str = "\n".join(lines)
    except Exception:
      pass
    atomic_write_text(os.path.join(RESULTS_DIR, "grade_for_review.txt"), grade_for_review_str)
  except Exception as e:
    # Log or ignore error, but don't break upload
    print(f"[grade_for_review] Failed to generate: {e}")

  base = request.host_url.rstrip('/')
  saved_preview_url = f"{base}/results/{os.path.basename(preview_png)}"

  # Build a visible "result" string like your other endpoints
  result_str = "Grade{\n" + "\n".join(grades_all) + "\n}\n"

  return jsonify({
    "mode": "pdf + qr + ocr",
    "saved_preview": f"results/{os.path.basename(preview_png)}",
    "saved_preview_url": saved_preview_url,
    "qr_url": qr_data,
    "grade_count_pdf": len(grades_all),
    "ocr_preview": raw_pdf_text[:500],
    "result": result_str
  })

def _read_grade_block_or_tokens(path):
  if not os.path.exists(path):
    return None
  with open(path, "r", encoding="utf-8") as f:
    txt = f.read()
  m = re.search(r"Grade\s*\{\s*([^}]*)\}", txt, flags=re.I)
  if m:
    vals = [s.strip() for s in m.group(1).splitlines() if s.strip()]
    return vals
  return re.findall(r"\b(?:\d\.\d{2}|[345]|INC)\b", txt, flags=re.I)

# ---- helpers for (old) Step 3 inversion trial (kept for reference) ----
def _extract_grades_from_text(raw_text: str):
  tokens = re.findall(r"[A-Za-z0-9\./\\|:;,\-]+", raw_text or "")
  out = []
  for t in tokens:
    g = _normalize_grade_token(t)
    if g:
      out.append(g)
  return out

# (Kept for debugging legacy image uploads)
@app.route('/upload_grade_image', methods=['POST'])
def upload_grade_image():
  """
  Legacy: image upload – OCR with 300-DPI preprocess.
  Always overwrites results/grade_image.txt on every upload.
  """
  if 'image' not in request.files:
    return jsonify({"error": "No image uploaded"}), 400
  image_file = request.files['image']

  tmp_in = None
  tmp_proc = None
  try:
    # Save upload to a temp file
    tmp_in_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    tmp_in = tmp_in_file.name
    tmp_in_file.close()
    Image.open(image_file.stream).convert("RGB").save(tmp_in)

    # Preprocess: ~300 DPI & min width
    tmp_proc = set_image_dpi(tmp_in)

    # OCR pass 1: original
    img_orig = Image.open(tmp_proc).convert("RGB")
    raw_orig = pytesseract.image_to_string(img_orig)
    grades_orig = _extract_grades_from_text(raw_orig)

    # OCR pass 2: inverted (helps when text is light on dark)
    img_inverted = ImageOps.invert(img_orig)
    raw_inverted = pytesseract.image_to_string(img_inverted)
    grades_inverted = _extract_grades_from_text(raw_inverted)

    # Pick whichever yields more grades; still overwrite the same file
    if len(grades_inverted) > len(grades_orig):
      chosen = "inverted"
      grades = grades_inverted
    else:
      chosen = "original"
      grades = grades_orig

    # ALWAYS OVERWRITE
    grade_block = "Grade{\n" + "\n".join(grades) + "\n}\n"
    out_path = os.path.join(RESULTS_DIR, "grade_image.txt")
    atomic_write_text(out_path, grade_block)  # unconditional replace
    os.utime(out_path, None)  # optional: bump mtime for watchers

    app.logger.info(f"[{datetime.now()}] WROTE {out_path} via {chosen} (grades={len(grades)})")

    # cache-busted URL so clients fetch fresh
    base = request.host_url.rstrip('/')
    grade_image_url = f"{base}/results/grade_image.txt?t={int(time.time())}"

    return jsonify({
      "message": "Grade image OCR complete",
      "strategy": chosen,
      "grade_image_file": "results/grade_image.txt",
      "grade_image_url": grade_image_url,
      "grade_count": len(grades),
      "preview": grade_block[:300],
    })
  except Exception as e:
    return jsonify({"error": f"Failed to process grade image: {str(e)}"}), 500
  finally:
    try:
      if tmp_in and os.path.exists(tmp_in):
        os.unlink(tmp_in)
    except Exception:
      pass
    try:
      if tmp_proc and os.path.exists(tmp_proc):
        os.unlink(tmp_proc)
    except Exception:
      pass

# -------------------- UPDATED TAMPER CHECK (PDF OCR vs WEBPAGE OCR) --------------------
@app.route('/validate_grade_tamper', methods=['GET'])
def validate_grade_tamper():
  """
  Returns plain text 'Copy of Grades is tampered' if files are missing
  or grades mismatch. Returns detailed JSON only when grades exactly match.
  Now compares PDF OCR vs QR-webpage OCR.
  """
  pdf_path = os.path.join(RESULTS_DIR, "grade_pdf_ocr.txt")
  web_path = os.path.join(RESULTS_DIR, "grade_webpage.txt")

  def tampered_response():
    return Response("Copy of Grades is tampered", mimetype="text/plain")

  # Both sources must exist
  if not os.path.exists(pdf_path) or not os.path.exists(web_path):
    return tampered_response()

  g_pdf = _read_grade_block_or_tokens(pdf_path) or []
  g_web = _read_grade_block_or_tokens(web_path) or []

  if g_pdf != g_web:
    return tampered_response()

  # Match → return detailed JSON (contract unchanged)
  return jsonify({
    "grades_from_pdf_ocr": g_pdf,
    "grades_from_webpage": g_web,
    "counts": {"pdf_ocr": len(g_pdf), "webpage": len(g_web)},
    "same_length": (len(g_pdf) == len(g_web)),
    "exact_match": True,
    "positional_mismatches": [],
    "only_in_pdf_ocr": [],
    "only_in_webpage": []
  })

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

def process_ocr_text(raw_text):
  lines = raw_text.splitlines()

  sr_code, sex, name, program_raw = extract_metadata(lines)

  coe_fields = parse_from_coe(raw_text)
  sem_word = to_semester_word(coe_fields.get("semester", ""))

  base_program, track, year_from_program = split_program_track_year(program_raw)
  year_from_coe = _YEAR_ORDINAL_MAP.get((coe_fields.get("year_level") or "").upper(), "")
  year_word = year_from_program or year_from_coe

  course_codes = []
  for line in lines:
    res = extract_course_data(line)
    if res:
      course_codes.append(res)

  result = []
  result.append(f"SR Code: {sr_code}")
  result.append(f"Sex: {sex}")
  result.append(f"Name: {name}")
  result.append(f"Program: {base_program}")
  result.append(f"track:{track}" if track else "track:")
  result.append(f"Semester : {sem_word}" if sem_word else "Semester :")
  result.append(f"Year Level : {year_word}" if year_word else "Year Level :")
  result.append("")
  result.append("COURSE CODE{")
  result.append(",\n".join(course_codes) + ",")
  result.append("}")
  return "\n".join(result)

@app.route('/generate_pdf_with_data', methods=['POST'])
def generate_pdf_with_data():
    try:
        data = request.json if request.is_json else {}
        name = data.get('name', '')
        course = data.get('course', '')
        yr_sec = data.get('yr_sec', '')
        scholarship_grant = data.get('scholarship_grant', '')
        track = data.get('track', '')
        contact_number = data.get('contact_number', '')

        template_pdf_path = "assets/DL_Template.pdf"
        output_pdf_path = os.path.join(RESULTS_DIR, "generated_application_filled.pdf")

        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=letter)
        c.setFont("Helvetica", 12)
        # Adjust coordinates to match your template fields
        c.drawString(100, 800, f"Name: {name}")
        c.drawString(100, 780, f"Contact Number: {contact_number}")
        c.drawString(100, 760, f"Course: {course}")
        c.drawString(100, 740, f"Yr./Sec.: {yr_sec}")
        c.drawString(300, 740, f"Track: {track}")
        c.drawString(100, 720, f"Scholarship Grant: {scholarship_grant}")
        c.save()

        packet.seek(0)
        new_pdf = PdfReader(packet)
        existing_pdf = PdfReader(template_pdf_path)
        output_pdf = PdfWriter()

        page = existing_pdf.pages[0]
        merger = PageMerge(page)
        merger.add(new_pdf.pages[0]).render()

        output_pdf.addpage(page)
        output_pdf.write(output_pdf_path)

        return jsonify({
            "message": "PDF generated successfully",
            "pdf_url": f"results/{os.path.basename(output_pdf_path)}"
        })

    except Exception as e:
        return jsonify({"error": f"Failed to generate PDF: {str(e)}"}), 500

# --- Simple debug endpoint to verify grade_image.txt on the server
@app.route('/debug/grade_image_txt', methods=['GET'])
def debug_grade_image_txt():
  p = os.path.join(RESULTS_DIR, "grade_image.txt")
  if not os.path.exists(p):
    return jsonify({"exists": False, "path": p}), 200
  st = os.stat(p)
  with open(p, "r", encoding="utf-8") as f:
    content = f.read()
  return jsonify({
    "exists": True,
    "path": p,
    "size": st.st_size,
    "mtime_epoch": st.st_mtime,
    "mtime_iso": datetime.fromtimestamp(st.st_mtime).isoformat(),
    "preview": content[:300]
  }), 200

if __name__ == '__main__':
  # Tip: set TESSDATA_PREFIX / poppler path per env as needed.
  app.run(host="0.0.0.0", port=5000, debug=True)
