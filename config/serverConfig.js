export const OCR_SERVER_CONFIG = {
  // Hosted OCR service (VPS)
  BASE_URL: 'https://ocr.achievemate.website',

  // OCR endpoints
  ENDPOINTS: {
    OCR: '/ocr',
    OCR_FULL: '/ocr/full', 
    OCR_POSITIONED: '/ocr/positioned',
    OCR_DIRECT: '/ocr/direct'
  },
  
  // Get full endpoint URL
  getEndpointURL(endpoint) {
    return `${this.BASE_URL}${endpoint}`;
  }
};

// Alternative localhost configuration for development
export const LOCALHOST_CONFIG = {
  HOST: 'localhost',
  PORT: '5000',
  
  get BASE_URL() {
    return `http://${this.HOST}:${this.PORT}`;
  }
};

// Network troubleshooting tips
export const NETWORK_TROUBLESHOOTING = {
  tips: [
    "1. Ensure OCR server is running: python ocr_server.py",
    "2. Check if port 5000 is open: netstat -an | findstr :5000", 
    "3. Verify IP address: ipconfig",
    "4. Test server locally: curl http://localhost:5000",
    "5. Check firewall settings for port 5000",
    "6. Ensure mobile device is on same network"
  ]
};
