# Tesseract OCR Installation Guide for Windows

## Quick Installation Steps:

### Method 1: Download Installer (Recommended)
1. **Download Tesseract installer:**
   - Go to: https://github.com/UB-Mannheim/tesseract/wiki
   - Download the latest Windows installer (e.g., `tesseract-ocr-w64-setup-5.3.3.20231005.exe`)

2. **Install Tesseract:**
   - Run the downloaded installer
   - Install to default location: `C:\Program Files\Tesseract-OCR\`
   - Make sure to check "Add to PATH" during installation

3. **Verify Installation:**
   - Open Command Prompt
   - Run: `tesseract --version`
   - You should see version information

### Method 2: Using Chocolatey (Alternative)
```bash
# Install Chocolatey first if you don't have it
# Then run:
choco install tesseract
```

### Method 3: Using Scoop (Alternative)
```bash
# Install Scoop first if you don't have it
# Then run:
scoop install tesseract
```

## After Installation:

1. **Restart your OCR server:**
   - Stop the current server (Ctrl+C)
   - Run: `python ocr_server.py`

2. **Test the OCR functionality:**
   - Try uploading a PDF in your app
   - The OCR should now work properly

## Troubleshooting:

If you installed Tesseract in a different location, update the path in `ocr_server.py`:
```python
pytesseract.pytesseract.tesseract_cmd = r'YOUR_TESSERACT_PATH\tesseract.exe'
```

Common installation paths:
- `C:\Program Files\Tesseract-OCR\tesseract.exe`
- `C:\Users\{username}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe`
- `C:\tools\tesseract\tesseract.exe` (Chocolatey)
