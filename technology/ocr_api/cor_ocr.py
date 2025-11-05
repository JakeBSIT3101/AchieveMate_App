import os
import re
from pdf2image import convert_from_bytes
from PIL import Image
import pytesseract

BASE_DIR = os.path.dirname(__file__)
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

def scale_image(image, scale_factor=2):
    new_size = (int(image.width * scale_factor), int(image.height * scale_factor))
    return image.resize(new_size, Image.LANCZOS)

def extract_cor_from_pdf(pdf_bytes):
    # Convert PDF → Image
    images = convert_from_bytes(
        pdf_bytes,
        first_page=1,
        last_page=1,
        poppler_path=r"C:\poppler-24.08.0\Library\bin"
    )
    if not images:
        raise ValueError("No image generated from PDF")

    original_image = images[0]
    width, height = original_image.size
    cropped_image = original_image.crop((0, 0, width, int(height * 0.6)))

    # Save cropped preview
    cropped_path = os.path.join(RESULTS_DIR, "cor_cropped.png")
    cropped_image.save(cropped_path)

    # OCR
    scaled = scale_image(cropped_image)
    raw_text = pytesseract.image_to_string(scaled)

    # Save raw text
    raw_text_path = os.path.join(RESULTS_DIR, "raw_cor_text.txt")
    with open(raw_text_path, "w", encoding="utf-8") as f:
        f.write(raw_text)

    # Parse key fields
    sr_code = name = program = academic_year = semester = year_level = ""
    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue
        if not sr_code and re.search(r"SR\s*Code[:\-]?\s*(\S+)", line, re.I):
            sr_code = re.search(r"SR\s*Code[:\-]?\s*(\S+)", line, re.I).group(1)
        if not name and re.search(r"Name[:\-]?\s*(.*)", line, re.I):
            name = re.search(r"Name[:\-]?\s*(.*)", line, re.I).group(1)
        if not program and re.search(r"Program[:\-]?\s*(.*)", line, re.I):
            program = re.search(r"Program[:\-]?\s*(.*)", line, re.I).group(1)
        if not academic_year and re.search(r"(Academic\s*Year|A\.Y\.?)[:\-]?\s*(.*20\d{2}.*)", line, re.I):
            academic_year = re.search(r"(Academic\s*Year|A\.Y\.?)[:\-]?\s*(.*20\d{2}.*)", line, re.I).group(2)
        if not semester and re.search(r"Semester[:\-]?\s*(.*)", line, re.I):
            semester = re.search(r"Semester[:\-]?\s*(.*)", line, re.I).group(1)
        if not year_level and re.search(r"Year\s*Level[:\-]?\s*(.*)", line, re.I):
            year_level = re.search(r"Year\s*Level[:\-]?\s*(.*)", line, re.I).group(1)

    parsed_data = {
        "sr_code": sr_code.strip(),
        "name": name.strip(),
        "program": program.strip(),
        "academic_year": academic_year.strip(),
        "semester": semester.strip(),
        "year_level": year_level.strip()
    }

    # Save parsed result
    parsed_path = os.path.join(RESULTS_DIR, "parsed_cor_data.txt")
    with open(parsed_path, "w", encoding="utf-8") as f:
        f.write(str(parsed_data))

    return {
        "raw_text_file": raw_text_path,
        "parsed_file": parsed_path,
        "cropped_image": cropped_path,
        "parsed_data": parsed_data
    }

# Example usage:
if __name__ == "__main__":
    pdf_path = input("Enter path to COR PDF: ")
    with open(pdf_path, "rb") as f:
        result = extract_cor_from_pdf(f.read())
    print("Extraction complete! Results saved in 'results/' folder:")
    print(result)