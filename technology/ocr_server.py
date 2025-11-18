# ocr_server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
from datetime import datetime
from pdf2image import convert_from_bytes
from PIL import Image
import pytesseract
import fitz  # PyMuPDF for direct PDF text extraction

# Configure Tesseract path (update this path after installing Tesseract)
# Default installation path for Windows
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

app = Flask(__name__)
CORS(app)  # Allow requests from your mobile app

BASE_DIR = os.path.dirname(__file__)
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

def scale_image(image, scale_factor=2):
    new_size = (int(image.width * scale_factor), int(image.height * scale_factor))
    return image.resize(new_size, Image.LANCZOS)

def extract_text_directly_from_pdf(pdf_bytes, original_filename="document.pdf"):
    """Extract text directly from PDF with enhanced accuracy"""
    pdf_document = None
    try:
        # Open PDF from bytes
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(pdf_document)
        
        all_text = []
        individual_pages = []
        
        for page_num in range(total_pages):
            page = pdf_document.load_page(page_num)
            
            # Try multiple extraction methods for best accuracy
            page_text = extract_text_with_multiple_methods(page, page_num + 1)
            
            page_header = f"=== PAGE {page_num + 1} === (Enhanced Direct PDF Extraction)"
            page_content = f"{page_header}\n{page_text}"
            
            all_text.append(page_content)
            individual_pages.append(page_text)
        
        full_text = "\n\n".join(all_text)
        
        # Save direct extraction results to file
        save_ocr_results_to_file(full_text, "direct", original_filename)
        
        return {
            "total_pages": total_pages,
            "full_text": full_text,
            "pages": individual_pages,
            "extraction_method": "enhanced_direct_pdf"
        }
        
    except Exception as e:
        print(f"Direct PDF extraction failed: {e}")
        raise e
    finally:
        # Ensure PDF document is properly closed
        if pdf_document:
            pdf_document.close()

def extract_text_with_multiple_methods(page, page_num):
    """Extract text using multiple methods and combine for best accuracy"""
    
    # Method 1: Direct text extraction with layout
    text_dict = page.get_text("dict")
    direct_text = extract_text_with_layout(text_dict)
    
    # Method 2: Simple text extraction (fallback)
    simple_text = page.get_text()
    
    # Method 3: Character grid layout
    grid_text = create_character_grid_layout(text_dict)
    
    # Method 4: High-resolution OCR (if no direct text available)
    ocr_text = ""
    
    # Choose the best method based on content quality
    best_text = choose_best_extraction(direct_text, simple_text, grid_text, page, page_num)
    
    # If still no good text, use high-quality OCR
    if not best_text.strip() or len(best_text.strip()) < 10:
        print(f"Page {page_num}: Using high-quality OCR extraction...")
        ocr_text = extract_with_high_quality_ocr(page)
        best_text = ocr_text if ocr_text.strip() else best_text
    
    return best_text

def choose_best_extraction(direct_text, simple_text, grid_text, page, page_num):
    """Choose the best extraction method based on content analysis"""
    
    # Try the new precise coordinate layout first
    text_dict = page.get_text("dict")
    precise_text = create_precise_coordinate_layout(text_dict)
    
    candidates = [
        ("precise_coordinate", precise_text),
        ("direct_layout", direct_text),
        ("grid", grid_text),
        ("simple", simple_text)
    ]
    
    # Score each candidate
    best_score = 0
    best_text = ""
    best_method = ""
    
    for method, text in candidates:
        if not text.strip():
            continue
            
        score = calculate_text_quality_score(text)
        
        # Bonus for methods that preserve layout better
        if method in ["precise_coordinate", "direct_layout", "grid"]:
            score += 2
        
        if score > best_score:
            best_score = score
            best_text = text
            best_method = method
    
    print(f"Page {page_num}: Best method = {best_method}, Score = {best_score:.2f}")
    return best_text

def create_precise_coordinate_layout(text_dict):
    """Create layout using precise coordinate mapping"""
    if not text_dict or "blocks" not in text_dict:
        return ""
    
    # Get page dimensions
    page_width = text_dict.get("width", 595)
    page_height = text_dict.get("height", 842)
    
    # Collect all text elements with precise coordinates
    text_elements = []
    for block in text_dict["blocks"]:
        if "lines" not in block:
            continue
        for line in block["lines"]:
            if "spans" not in line:
                continue
            for span in line["spans"]:
                text = span.get("text", "")
                if text.strip():
                    text_elements.append({
                        "text": text,
                        "x": span["bbox"][0],
                        "y": span["bbox"][1],
                        "width": span["bbox"][2] - span["bbox"][0],
                        "height": span["bbox"][3] - span["bbox"][1],
                        "font_size": span.get("size", 12)
                    })
    
    if not text_elements:
        return ""
    
    # Sort by Y coordinate (top to bottom), then X coordinate (left to right)
    text_elements.sort(key=lambda x: (x["y"], x["x"]))
    
    # Group elements into lines based on Y coordinate proximity
    lines = []
    current_line = []
    tolerance = 5  # Y coordinate tolerance for same line
    
    for element in text_elements:
        if not current_line:
            current_line = [element]
        else:
            # Check if element is on the same line
            avg_y = sum(e["y"] for e in current_line) / len(current_line)
            if abs(element["y"] - avg_y) <= tolerance:
                current_line.append(element)
            else:
                # Start new line
                lines.append(sorted(current_line, key=lambda x: x["x"]))
                current_line = [element]
    
    # Add the last line
    if current_line:
        lines.append(sorted(current_line, key=lambda x: x["x"]))
    
    # Convert to text with precise spacing
    result_lines = []
    last_y = 0
    
    for line_elements in lines:
        if not line_elements:
            continue
        
        # Add vertical spacing
        current_y = min(e["y"] for e in line_elements)
        if last_y > 0:
            line_gap = current_y - last_y
            if line_gap > 20:  # Significant vertical gap
                blank_lines = max(1, min(int(line_gap / 15), 4))
                result_lines.extend([""] * blank_lines)
        
        # Build line with precise horizontal positioning
        line_chars = [' '] * 200  # Create a character array
        
        for element in line_elements:
            # Calculate character position based on X coordinate
            char_pos = int(element["x"] / 4)  # Adjust this ratio for better alignment
            char_pos = max(0, min(char_pos, len(line_chars) - len(element["text"])))
            
            # Place text in character array
            text = element["text"]
            for i, char in enumerate(text):
                if char_pos + i < len(line_chars):
                    line_chars[char_pos + i] = char
        
        # Convert character array to string
        line_text = ''.join(line_chars).rstrip()
        result_lines.append(line_text)
        
        last_y = max(e["y"] + e["height"] for e in line_elements)
    
    # Remove trailing empty lines
    while result_lines and not result_lines[-1].strip():
        result_lines.pop()
    
    return "\n".join(result_lines)

def calculate_text_quality_score(text):
    """Calculate a quality score for extracted text"""
    if not text.strip():
        return 0
    
    score = 0
    lines = text.split('\n')
    
    # Length score (more text usually better)
    score += min(len(text.strip()) / 100, 10)
    
    # Line count score (structured text has multiple lines)
    score += min(len([l for l in lines if l.strip()]) / 5, 5)
    
    # Character variety score (good text has varied characters)
    unique_chars = len(set(text.lower()))
    score += min(unique_chars / 10, 5)
    
    # Word count score
    words = len(text.split())
    score += min(words / 20, 10)
    
    # Penalty for too many special characters (OCR artifacts)
    special_chars = sum(1 for c in text if not c.isalnum() and c not in ' \n\t.,;:!?-()[]{}')
    if len(text) > 0:
        special_ratio = special_chars / len(text)
        if special_ratio > 0.3:
            score -= 5
    
    return score

def extract_with_high_quality_ocr(page):
    """Extract text using high-quality OCR with preprocessing"""
    try:
        # Convert page to high-resolution image
        mat = fitz.Matrix(3.0, 3.0)  # 3x zoom for better quality
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("png")
        
        from io import BytesIO
        img = Image.open(BytesIO(img_data))
        
        # Apply image preprocessing for better OCR
        processed_img = preprocess_image_for_ocr(img)
        
        # Use multiple OCR configurations and choose best result
        ocr_configs = [
            '--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,;:!?-()[]{}/',
            '--psm 4 --oem 3',
            '--psm 6 --oem 1',
            '--psm 3 --oem 3'
        ]
        
        best_text = ""
        best_score = 0
        
        for config in ocr_configs:
            try:
                text = pytesseract.image_to_string(processed_img, config=config)
                score = calculate_text_quality_score(text)
                if score > best_score:
                    best_score = score
                    best_text = text
            except:
                continue
        
        return best_text
        
    except Exception as e:
        print(f"High-quality OCR failed: {e}")
        return ""

def preprocess_image_for_ocr(image):
    """Preprocess image to improve OCR accuracy"""
    try:
        import numpy as np
        from PIL import ImageEnhance, ImageFilter
        
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        # Enhance sharpness
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(2.0)
        
        # Apply slight blur to reduce noise
        image = image.filter(ImageFilter.MedianFilter(size=3))
        
        return image
        
    except Exception as e:
        print(f"Image preprocessing failed: {e}")
        return image

def extract_text_with_layout(text_dict):
    """Extract text from PyMuPDF text dict while preserving exact layout"""
    if not text_dict or "blocks" not in text_dict:
        return ""
    
    # Get page dimensions for relative positioning
    page_width = text_dict.get("width", 595)  # Default A4 width
    page_height = text_dict.get("height", 842)  # Default A4 height
    
    # Collect all text elements with their positions
    text_elements = []
    
    for block in text_dict["blocks"]:
        if "lines" not in block:
            continue
            
        for line in block["lines"]:
            if "spans" not in line:
                continue
                
            for span in line["spans"]:
                text = span.get("text", "")
                if text.strip():
                    text_elements.append({
                        "text": text,
                        "bbox": span["bbox"],  # [x0, y0, x1, y1]
                        "left": span["bbox"][0],
                        "top": span["bbox"][1],
                        "right": span["bbox"][2],
                        "bottom": span["bbox"][3],
                        "width": span["bbox"][2] - span["bbox"][0],
                        "height": span["bbox"][3] - span["bbox"][1]
                    })
    
    if not text_elements:
        return ""
    
    # Sort by vertical position first, then horizontal
    text_elements.sort(key=lambda x: (x["top"], x["left"]))
    
    # Group elements into lines based on vertical overlap
    lines = []
    current_line = []
    current_line_top = text_elements[0]["top"]
    current_line_bottom = text_elements[0]["bottom"]
    
    for element in text_elements:
        # Check if element overlaps vertically with current line
        element_top = element["top"]
        element_bottom = element["bottom"]
        
        # Elements are on the same line if they overlap vertically
        if (element_top <= current_line_bottom and element_bottom >= current_line_top):
            current_line.append(element)
            # Expand line boundaries
            current_line_top = min(current_line_top, element_top)
            current_line_bottom = max(current_line_bottom, element_bottom)
        else:
            # Start new line
            if current_line:
                lines.append(sorted(current_line, key=lambda x: x["left"]))
            current_line = [element]
            current_line_top = element_top
            current_line_bottom = element_bottom
    
    # Add the last line
    if current_line:
        lines.append(sorted(current_line, key=lambda x: x["left"]))
    
    # Reconstruct text with precise spacing
    result_lines = []
    last_line_bottom = 0
    
    for line_elements in lines:
        if not line_elements:
            continue
            
        # Add vertical spacing between lines
        current_line_top = min(elem["top"] for elem in line_elements)
        if last_line_bottom > 0:
            vertical_gap = current_line_top - last_line_bottom
            if vertical_gap > 5:  # Significant vertical gap
                blank_lines = max(1, min(int(vertical_gap / 15), 3))  # Convert to blank lines
                result_lines.extend([""] * blank_lines)
        
        # Build the line with precise horizontal positioning
        line_text = ""
        line_left_margin = line_elements[0]["left"]
        
        # Calculate more precise left margin
        if line_left_margin > 20:  # Any significant left margin
            # Use more precise character width calculation
            avg_char_width = 6.5  # More accurate average character width in PDF units
            margin_spaces = int(line_left_margin / avg_char_width)
            line_text = " " * min(margin_spaces, 80)  # Allow more margin space
        
        last_right = line_left_margin
        
        for element in line_elements:
            text = element["text"]
            element_left = element["left"]
            
            # Calculate horizontal gap with better precision
            gap = element_left - last_right
            if gap > 3:  # Any noticeable gap
                # More precise gap-to-space conversion
                avg_char_width = 6.5
                spaces = max(1, int(gap / avg_char_width))
                spaces = min(spaces, 50)  # Allow more spacing for alignment
                line_text += " " * spaces
            elif gap > 0.5 and line_text and not line_text.endswith(" "):
                line_text += " "  # Minimum single space for small gaps
            
            line_text += text
            last_right = element["right"]
        
        result_lines.append(line_text.rstrip())
        last_line_bottom = max(elem["bottom"] for elem in line_elements)
    
    return "\n".join(result_lines)

def create_character_grid_layout(text_dict):
    """Create a character-based grid layout for maximum precision"""
    if not text_dict or "blocks" not in text_dict:
        return ""
    
    # Get page dimensions
    page_width = text_dict.get("width", 595)
    page_height = text_dict.get("height", 842)
    
    # Use higher resolution grid for better precision
    chars_per_line = 150  # Increased resolution
    lines_per_page = 80   # Increased resolution
    
    # Create a 2D grid to place characters
    grid = [[' ' for _ in range(chars_per_line)] for _ in range(lines_per_page)]
    
    # Collect all text elements with more detailed positioning
    text_elements = []
    for block in text_dict["blocks"]:
        if "lines" not in block:
            continue
        for line in block["lines"]:
            if "spans" not in line:
                continue
            for span in line["spans"]:
                text = span.get("text", "")
                if text.strip():
                    text_elements.append({
                        "text": text,
                        "left": span["bbox"][0],
                        "top": span["bbox"][1],
                        "right": span["bbox"][2],
                        "bottom": span["bbox"][3],
                        "font_size": span.get("size", 12)
                    })
    
    # Sort by vertical position first, then horizontal
    text_elements.sort(key=lambda x: (x["top"], x["left"]))
    
    # Place text elements in grid with better positioning
    for element in text_elements:
        # More precise coordinate mapping
        grid_x = int((element["left"] / page_width) * chars_per_line)
        grid_y = int((element["top"] / page_height) * lines_per_page)
        
        # Ensure within bounds
        grid_x = max(0, min(grid_x, chars_per_line - len(element["text"])))
        grid_y = max(0, min(grid_y, lines_per_page - 1))
        
        # Place text character by character, preserving spaces
        text = element["text"]
        for i, char in enumerate(text):
            if grid_x + i < chars_per_line:
                # Only overwrite spaces, preserve existing characters
                if grid[grid_y][grid_x + i] == ' ':
                    grid[grid_y][grid_x + i] = char
    
    # Convert grid back to text with better line handling
    result_lines = []
    for row in grid:
        line = ''.join(row).rstrip()
        result_lines.append(line)
    
    # Remove trailing empty lines but preserve internal spacing
    while result_lines and not result_lines[-1].strip():
        result_lines.pop()
    
    return "\n".join(result_lines)

def extract_text_with_positions(image):
    """Extract text with bounding box coordinates to preserve layout"""
    # Get detailed OCR data with coordinates
    ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    
    # Filter out empty text
    filtered_data = []
    for i in range(len(ocr_data['text'])):
        text = ocr_data['text'][i].strip()
        if text and int(ocr_data['conf'][i]) > 30:  # Only include confident detections
            filtered_data.append({
                'text': text,
                'left': ocr_data['left'][i],
                'top': ocr_data['top'][i],
                'width': ocr_data['width'][i],
                'height': ocr_data['height'][i],
                'conf': ocr_data['conf'][i],
                'level': ocr_data['level'][i]
            })
    
    return filtered_data

def reconstruct_layout_text(positioned_text_data, image_width, image_height):
    """Reconstruct text maintaining approximate spatial layout"""
    if not positioned_text_data:
        return "No text detected"
    
    # Sort by top position first, then left position
    sorted_data = sorted(positioned_text_data, key=lambda x: (x['top'], x['left']))
    
    # Group text by approximate lines (within 10 pixels vertically)
    lines = []
    current_line = []
    current_top = sorted_data[0]['top'] if sorted_data else 0
    
    for item in sorted_data:
        if abs(item['top'] - current_top) <= 15:  # Same line
            current_line.append(item)
        else:  # New line
            if current_line:
                lines.append(sorted(current_line, key=lambda x: x['left']))
            current_line = [item]
            current_top = item['top']
    
    if current_line:
        lines.append(sorted(current_line, key=lambda x: x['left']))
    
    # Reconstruct text with spacing
    result_lines = []
    for line in lines:
        line_text = ""
        last_right = 0
        
        for item in line:
            # Add spacing based on horizontal gap
            gap = item['left'] - last_right
            if gap > 20 and line_text:  # Significant gap
                spaces = min(gap // 10, 10)  # Approximate spacing
                line_text += " " * spaces
            elif line_text and gap > 5:
                line_text += " "
            
            line_text += item['text']
            last_right = item['left'] + item['width']
        
        result_lines.append(line_text)
    
    return "\n".join(result_lines)

def fix_course_title_spacing(title):
    """Fix spacing issues in course titles by adding spaces between words"""
    import re
    
    # Remove extra spaces first
    title = re.sub(r'\s+', ' ', title.strip())
    
    # Add space before capital letters that follow lowercase letters
    # e.g., "AnalyticsApplication" -> "Analytics Application"
    title = re.sub(r'([a-z])([A-Z])', r'\1 \2', title)
    
    # Add space before numbers that follow letters
    # e.g., "Project2" -> "Project 2"
    title = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', title)
    
    # Add space after numbers that are followed by letters
    # e.g., "2Advanced" -> "2 Advanced"
    title = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', title)
    
    # Fix common OCR issues
    replacements = {
        'andProfessional': 'and Professional',
        'QualityAssurance': 'Quality Assurance',
        'InformationAssurance': 'Information Assurance',
        'andSecurity': 'and Security',
        'SocialIssues': 'Social Issues',
        'PlatformTechnologies': 'Platform Technologies',
        'CapstoneProject': 'Capstone Project',
        'DatabaseManagement': 'Database Management',
        'ManagementSystem': 'Management System',
        'ComputerNetworking': 'Computer Networking',
        'DataAnalysis': 'Data Analysis',
        'TeamSports': 'Team Sports',
        'EnvironmentalSciences': 'Environmental Sciences'
    }
    
    for old, new in replacements.items():
        title = title.replace(old, new)
    
    # Clean up multiple spaces
    title = re.sub(r'\s+', ' ', title).strip()
    
    return title

def format_grades_table(text_content):
    """Automatically format grades table for better alignment and parsing"""
    lines = text_content.split('\n')
    formatted_lines = []
    in_grades_section = False
    grades_data = []
    student_info = {}
    
    # Extract student information
    for line in lines:
        line = line.strip()
        if 'Fullname' in line and ':' in line:
            student_info['name'] = line.split(':', 1)[1].strip().split()[0:3]  # Get first 3 parts
            student_info['name'] = ' '.join([part for part in student_info['name'] if part])
        elif 'SRCODE' in line and ':' in line:
            student_info['sr_code'] = line.split(':', 1)[1].strip()
        elif 'College' in line and ':' in line:
            student_info['college'] = line.split(':', 1)[1].strip().split('Academic')[0].strip()
        elif 'Academic Year' in line and ':' in line:
            student_info['academic_year'] = line.split('Academic Year')[1].split(':')[1].strip()
        elif 'Program' in line and ':' in line:
            student_info['program'] = line.split(':', 1)[1].strip().split('Semester')[0].strip()
        elif 'Semester' in line and ':' in line:
            student_info['semester'] = line.split('Semester')[1].split(':')[1].strip()
        elif 'Year Level' in line and ':' in line:
            student_info['year_level'] = line.split(':', 1)[1].strip()
    
    # Process each line
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Check if we're entering grades section
        if 'Course Code' in line and 'Course Title' in line and 'Units' in line and 'Grade' in line:
            in_grades_section = True
            formatted_lines.append(line)  # Keep original header for context
            # Add formatted table header
            formatted_lines.append("")
            formatted_lines.append("      #  | Course Code | Course Title                              | Units | Grade | Section | Instructor")
            formatted_lines.append("     ---|-------------|-------------------------------------------|-------|-------|---------|---------------------------")
            i += 1
            continue
        
        # Process grade entries
        if in_grades_section and re.match(r'\s*\d+\s+', line):
            # Parse grade line using regex
            grade_match = re.match(r'\s*(\d+)\s+([A-Z][A-Za-z\s\d]+?)\s+([A-Za-z][A-Za-z\s&\-\d]+?)\s+(\d+)\s+([\d.]+)\s+([A-Z\-\d]+)\s+(.+)', line)
            
            if grade_match:
                num, code, title, units, grade, section, instructor = grade_match.groups()
                
                # Clean up the data
                code = code.strip()
                title = fix_course_title_spacing(title.strip())  # Fix spacing in course titles
                units = units.strip()
                grade = grade.strip()
                section = section.strip()
                instructor = instructor.strip()
                
                # Format the line with proper alignment
                formatted_line = f"     {num:<2} | {code:<11} | {title:<41} | {units:>3}   | {grade:<5} | {section:<7} | {instructor}"
                formatted_lines.append(formatted_line)
                
                # Store for structured data section
                grades_data.append({
                    'code': code,
                    'title': title,
                    'units': units,
                    'grade': grade,
                    'section': section,
                    'instructor': instructor
                })
            else:
                formatted_lines.append(line)
        
        # Check for end of grades section
        elif in_grades_section and ('NOTHING FOLLOWS' in line or 'Total no of Course' in line):
            in_grades_section = False
            formatted_lines.append(line)
        else:
            formatted_lines.append(line)
        
        i += 1
    
    # Add structured data section if grades were found
    if grades_data:
        formatted_lines.append("")
        formatted_lines.append("======================")
        formatted_lines.append("STRUCTURED DATA FOR EASY PARSING")
        formatted_lines.append("======================")
        formatted_lines.append("")
        formatted_lines.append("COURSE_CODE|COURSE_TITLE|UNITS|GRADE|SECTION|INSTRUCTOR")
        
        for grade in grades_data:
            formatted_lines.append(f"{grade['code']}|{grade['title']}|{grade['units']}|{grade['grade']}|{grade['section']}|{grade['instructor']}")
        
        # Add summary
        if grades_data:
            total_courses = len(grades_data)
            total_units = sum(int(grade['units']) for grade in grades_data)
            
            formatted_lines.append("")
            formatted_lines.append("SUMMARY:")
            formatted_lines.append(f"Total Courses: {total_courses}")
            formatted_lines.append(f"Total Units: {total_units}")
            
            # Calculate GWA if possible
            try:
                total_grade_points = sum(float(grade['grade']) * int(grade['units']) for grade in grades_data)
                gwa = total_grade_points / total_units
                formatted_lines.append(f"GWA: {gwa:.4f}")
            except:
                pass
        
        # Add student info
        if student_info:
            formatted_lines.append("")
            formatted_lines.append("STUDENT INFO:")
            if 'name' in student_info:
                formatted_lines.append(f"Name: {student_info['name']}")
            if 'sr_code' in student_info:
                formatted_lines.append(f"SR Code: {student_info['sr_code']}")
            if 'college' in student_info:
                formatted_lines.append(f"College: {student_info['college']}")
            if 'program' in student_info:
                formatted_lines.append(f"Program: {student_info['program']}")
            if 'academic_year' in student_info:
                formatted_lines.append(f"Academic Year: {student_info['academic_year']}")
            if 'semester' in student_info:
                formatted_lines.append(f"Semester: {student_info['semester']}")
            if 'year_level' in student_info:
                formatted_lines.append(f"Year Level: {student_info['year_level']}")
    
    return '\n'.join(formatted_lines)

def save_ocr_results_to_file(text_content, file_type="full", original_filename="document"):
    """Save OCR results to a timestamped text file with automatic formatting"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # Clean the original filename
    clean_filename = re.sub(r'[^\w\-_.]', '_', original_filename.replace('.pdf', ''))
    
    filename = f"OCR_{file_type}_{clean_filename}_{timestamp}.txt"
    filepath = os.path.join(RESULTS_DIR, filename)
    
    try:
        # Apply automatic formatting for grades documents
        if 'grades' in original_filename.lower() or 'Course Code' in text_content:
            formatted_content = format_grades_table(text_content)
        else:
            formatted_content = text_content
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"OCR Extraction Results\n")
            f.write(f"======================\n")
            f.write(f"Original File: {original_filename}\n")
            f.write(f"Extraction Type: {file_type}\n")
            f.write(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"======================\n\n")
            f.write(formatted_content)
        
        print(f"OCR results saved to: {filepath}")
        return filepath
    except Exception as e:
        print(f"Error saving OCR results: {e}")
        return None

def extract_cor_from_pdf(pdf_bytes, original_filename="document.pdf"):
    # Convert PDF → Images (ALL pages)
    images = convert_from_bytes(
        pdf_bytes,
        poppler_path = r"c:\xampp\htdocs\AchievemateApp\AchieveMate_App\poppler\poppler-24.08.0\Library\bin"
    )
    if not images:
        raise ValueError("No image generated from PDF")

    # Extract text from ALL pages
    all_text = []
    for page_num, image in enumerate(images, 1):
        # Scale image for better OCR accuracy
        scaled = scale_image(image)
        page_text = pytesseract.image_to_string(scaled)
        all_text.append(f"=== PAGE {page_num} ===\n{page_text}")
    
    raw_text = "\n\n".join(all_text)
    
    # Save raw text to file
    save_ocr_results_to_file(raw_text, "parsed", original_filename)

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

    return {
        "sr_code": sr_code.strip(),
        "name": name.strip(),
        "program": program.strip(),
        "academic_year": academic_year.strip(),
        "semester": semester.strip(),
        "year_level": year_level.strip(),
        "raw_text": raw_text
    }

def extract_all_text_from_pdf(pdf_bytes, original_filename="document.pdf"):
    """Extract all text from all pages of a PDF without field parsing"""
    # Convert PDF → Images (ALL pages)
    images = convert_from_bytes(
        pdf_bytes,
        poppler_path = r"c:\xampp\htdocs\AchievemateApp\AchieveMate_App\poppler\poppler-24.08.0\Library\bin"
    )
    if not images:
        raise ValueError("No image generated from PDF")

    # Extract text from ALL pages
    all_text = []
    individual_pages = []
    for page_num, image in enumerate(images, 1):
        # Scale image for better OCR accuracy
        scaled = scale_image(image)
        page_text = pytesseract.image_to_string(scaled)
        all_text.append(f"=== PAGE {page_num} ===\n{page_text}")
        individual_pages.append(page_text)
    
    full_text = "\n\n".join(all_text)
    
    # Save full text to file
    save_ocr_results_to_file(full_text, "full", original_filename)
    
    return {
        "total_pages": len(images),
        "full_text": full_text,
        "pages": individual_pages
    }

def extract_positioned_text_from_pdf(pdf_bytes, original_filename="document.pdf"):
    """Extract text from PDF preserving layout and positioning"""
    # Convert PDF → Images (ALL pages)
    images = convert_from_bytes(
        pdf_bytes,
        poppler_path = r"c:\xampp\htdocs\AchievemateApp\AchieveMate_App\poppler\poppler-24.08.0\Library\bin"
    )
    if not images:
        raise ValueError("No image generated from PDF")

    # Extract positioned text from ALL pages
    all_positioned_text = []
    individual_pages = []
    
    for page_num, image in enumerate(images, 1):
        # Scale image for better OCR accuracy
        scaled = scale_image(image)
        
        # Extract text with positions
        positioned_data = extract_text_with_positions(scaled)
        
        # Reconstruct layout-preserved text
        layout_text = reconstruct_layout_text(positioned_data, scaled.width, scaled.height)
        
        page_header = f"=== PAGE {page_num} === (Layout Preserved)"
        page_content = f"{page_header}\n{layout_text}"
        
        all_positioned_text.append(page_content)
        individual_pages.append(layout_text)
    
    full_positioned_text = "\n\n".join(all_positioned_text)
    
    # Save positioned text to file
    save_ocr_results_to_file(full_positioned_text, "positioned", original_filename)
    
    return {
        "total_pages": len(images),
        "full_text": full_positioned_text,
        "pages": individual_pages
    }

@app.route("/ocr", methods=["POST"])
def ocr_endpoint():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    pdf_file = request.files["file"]
    try:
        result = extract_cor_from_pdf(pdf_file.read(), pdf_file.filename or "document.pdf")
        result["saved_file"] = f"OCR results saved to results folder"
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/ocr/full", methods=["POST"])
def ocr_full_text_endpoint():
    """Extract all text from all pages of uploaded PDF"""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    pdf_file = request.files["file"]
    try:
        result = extract_all_text_from_pdf(pdf_file.read(), pdf_file.filename or "document.pdf")
        result["saved_file"] = f"OCR results saved to results folder"
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/ocr/positioned", methods=["POST"])
def ocr_positioned_text_endpoint():
    """Extract text from PDF preserving layout and positioning"""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    pdf_file = request.files["file"]
    try:
        result = extract_positioned_text_from_pdf(pdf_file.read(), pdf_file.filename or "document.pdf")
        result["saved_file"] = f"Positioned OCR results saved to results folder"
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/ocr/direct", methods=["POST"])
def ocr_direct_pdf_endpoint():
    """Extract text directly from PDF without image conversion"""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    pdf_file = request.files["file"]
    try:
        pdf_bytes = pdf_file.read()
        if not pdf_bytes:
            return jsonify({"error": "Empty file uploaded"}), 400
            
        result = extract_text_directly_from_pdf(pdf_bytes, pdf_file.filename or "document.pdf")
        result["saved_file"] = f"Direct PDF extraction results saved to results folder"
        return jsonify(result)
    except Exception as e:
        print(f"OCR Direct endpoint error: {e}")
        return jsonify({"error": f"PDF extraction failed: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
