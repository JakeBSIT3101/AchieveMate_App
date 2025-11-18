# OCR Server Network Troubleshooting Guide

## Problem Fixed: Network Request Failed Errors

The "Network request failed" errors were caused by incorrect IP address configuration in the frontend code.

### ✅ Changes Made:

1. **Updated IP Address**: Changed from `192.168.254.114` to `192.168.18.162` (your current network IP)
2. **Centralized Configuration**: Created `config/serverConfig.js` for easy IP management
3. **Updated All Files**: Fixed IP addresses in:
   - `screens/UploadGrades.js`
   - `screens/ApplicationForGraduation.js`

### 🔧 How to Update IP Address in Future:

1. **Find your current IP**:
   ```cmd
   ipconfig
   ```
   Look for "IPv4 Address" under your active network adapter.

2. **Update the config file**:
   Edit `config/serverConfig.js` and change the `HOST` value:
   ```javascript
   HOST: 'YOUR_NEW_IP_ADDRESS',
   ```

### 🧪 Testing Server Connectivity:

1. **Check if server is running**:
   ```cmd
   netstat -an | findstr :5000
   ```
   Should show: `TCP 0.0.0.0:5000 0.0.0.0:0 LISTENING`

2. **Test server locally** (if you have curl):
   ```cmd
   curl http://localhost:5000
   ```

3. **Check network IP**:
   ```cmd
   curl http://192.168.18.162:5000
   ```

### 🔥 Common Issues & Solutions:

#### Issue: "Network request failed"
**Solutions:**
- ✅ **Fixed**: Updated IP address to match current network
- Ensure OCR server is running: `python ocr_server.py`
- Check Windows Firewall for port 5000
- Verify mobile device is on same WiFi network

#### Issue: "Connection refused"
**Solutions:**
- Start OCR server: `cd technology && python ocr_server.py`
- Check if port 5000 is available
- Restart the server

#### Issue: "Timeout"
**Solutions:**
- Check firewall settings
- Ensure mobile device and computer are on same network
- Try using localhost (127.0.0.1) for testing

### 📱 Mobile App Network Requirements:

1. **Same Network**: Mobile device and computer must be on same WiFi
2. **Firewall**: Windows Firewall should allow port 5000
3. **Server Running**: OCR server must be active on port 5000

### 🚀 Quick Start:

1. **Start OCR Server**:
   ```cmd
   cd c:\xampp\htdocs\AchievemateApp\AchieveMate_App\technology
   python ocr_server.py
   ```

2. **Verify Server**:
   - Should see: "Running on http://0.0.0.0:5000"
   - Port 5000 should be listening

3. **Test Mobile App**:
   - Upload a PDF file
   - OCR should now work without network errors

### 📋 Server Configuration:

- **Host**: 0.0.0.0 (accepts connections from any IP)
- **Port**: 5000
- **Endpoints**:
  - `/ocr` - Basic OCR with field parsing
  - `/ocr/full` - Full text extraction
  - `/ocr/positioned` - Layout-preserved extraction
  - `/ocr/direct` - Direct PDF text extraction

### 🔍 Debugging Commands:

```cmd
# Check current IP
ipconfig

# Check if port is listening
netstat -an | findstr :5000

# Test server locally
python technology/test_server.py

# Start OCR server
cd technology
python ocr_server.py
```

---

**Status**: ✅ **RESOLVED** - Network request failed errors should now be fixed with the updated IP configuration.
