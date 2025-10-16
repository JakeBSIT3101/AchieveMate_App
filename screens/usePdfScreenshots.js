// Utility to fetch and preview PDF screenshots for Step 7
import { useState } from "react";
import { OCR_URL } from "../config/api";

export function usePdfScreenshots() {
  const [pdfScreenshots, setPdfScreenshots] = useState([null, null]); // [page1, page2]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Call this after PDF is generated
  const fetchScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      // Assume backend saves screenshots as results/generated_application_page1.png, page2.png
      const page1 = `${OCR_URL}/results/generated_application_page1.png?t=${Date.now()}`;
      const page2 = `${OCR_URL}/results/generated_application_page2.png?t=${Date.now()}`;
      // Optionally, you could check if these URLs exist
      setPdfScreenshots([page1, page2]);
    } catch (e) {
      setError(e.message || "Failed to load PDF screenshots");
    } finally {
      setLoading(false);
    }
  };

  return { pdfScreenshots, loading, error, fetchScreenshots };
}
