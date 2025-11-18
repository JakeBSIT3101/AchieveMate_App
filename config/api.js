import { OCR_SERVER_CONFIG } from "./serverConfig";

// Laravel API endpoint
const BASE_URL = "https://achievemate.website/api";

// Base URL for the OCR service; update host/port in serverConfig.js when network changes
const OCR_URL = `${OCR_SERVER_CONFIG.BASE_URL}`;

export { BASE_URL, OCR_URL };
