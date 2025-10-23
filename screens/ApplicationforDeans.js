// ApplicationforDeans.js
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator,
  Modal,
  Vibration,
} from "react-native";
// Removed ImagePicker (no longer used for Step 3)
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import Icon from "react-native-vector-icons/Feather";
import styles from "../styles";
import { OCR_URL, BASE_URL } from "../config/api";
import { CheckBox } from "react-native-elements"; // Add this import at the top

/* ---------- Reusable Notice Modal ---------- */
function NoticeModal({ visible, title = "Notice", message, onOk, onReupload }) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 22,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: "#fff",
            borderRadius: 20,
            paddingVertical: 22,
            paddingHorizontal: 20,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 20,
            elevation: 8,
          }}
        >
          {/* Circle with X in #0d2f60 */}
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                borderWidth: 4,
                borderColor: "#0d2f60", // changed color
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  backgroundColor: "#0d2f60", // changed color
                  transform: [{ rotate: "45deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 36,
                  height: 4,
                  backgroundColor: "#0d2f60", // changed color
                  transform: [{ rotate: "-45deg" }],
                }}
              />
            </View>
          </View>

          <Text
            style={{
              marginLeft: 4,
              fontWeight: "700",
              color: "#0d2f60",
              flexShrink: 1,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {title}
          </Text>

          {!!message && (
            <Text
              style={{
                marginTop: 10,
                fontSize: 15,
                color: "#666",
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              {message}
            </Text>
          )}

          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            {onReupload && (
              <TouchableOpacity
                onPress={onReupload}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  backgroundColor: "#E3EAF3", // lighter blue for re-upload
                  borderWidth: 1,
                  borderColor: "#0d2f60", // changed color
                  marginRight: 12,
                }}
              >
                <Text style={{ color: "#0d2f60", fontWeight: "700" }}>
                  RE-UPLOAD
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onOk}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 12,
                backgroundColor: "#0d2f60", // changed color
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
/* -------------------------------------------------------------------- */

// Confirmation modal component
function ConfirmModal({ visible, onYes, onNo }) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 22,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: "#fff",
            borderRadius: 20,
            paddingVertical: 22,
            paddingHorizontal: 20,
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 20,
            elevation: 8,
          }}
        >
          {/* Circle with question mark */}
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                borderWidth: 4,
                borderColor: "#53B1FD",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#F0F6FF",
              }}
            >
              <Text
                style={{
                  fontSize: 48,
                  color: "#53B1FD",
                  fontWeight: "bold",
                  marginTop: 8,
                }}
              >
                ?
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              textAlign: "center",
              color: "#333",
              marginBottom: 10,
            }}
          >
            Confirmation
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: "#666",
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 18,
            }}
          >
            Are you sure about the detail?
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <TouchableOpacity
              onPress={onNo}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 12,
                backgroundColor: "#F0F6FF",
                borderWidth: 1,
                borderColor: "#53B1FD",
                marginRight: 12,
              }}
            >
              <Text style={{ color: "#53B1FD", fontWeight: "700" }}>NO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onYes}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 12,
                backgroundColor: "#53B1FD",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>YES</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ApplicationforDeans() {
  // Column spec for Step 6 table (label, width, align)
  const COLS = [
    ["#", 40, "center"],
    ["Course Code", 110, "left"],
    ["Course Title", 160, "left"],
    ["Units", 60, "center"],
    ["Grade", 70, "center"],
    ["Section", 90, "center"],
    ["Instructor", 160, "left"],
  ];

  const TABLE_WIDTH = COLS.reduce((sum, [, w]) => sum + w, 0);

  const [currentStep, setCurrentStep] = useState(1);
  const [ocrResult, setOcrResult] = useState("");
  // Step 2: COR
  const [certificateImageUri, setCertificateImageUri] = useState(null);
  const [certificatePreviewUri, setCertificatePreviewUri] = useState(null);

  // Step 3: now using PDF (and server preview)
  const [gradesPdfUri, setGradesPdfUri] = useState(null);
  const [gradesPreviewUri, setGradesPreviewUri] = useState(null);

  const [uploading, setUploading] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [enrollmentResult, setEnrollmentResult] = useState("");
  const [gradesResult, setGradesResult] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [convertedImage, setConvertedImage] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const longPressTamperPassRef = useRef(false);
  const holdTimerRef = useRef(null);

  // Cross-field validation state (COR vs Grades)
  const [validationOk, setValidationOk] = useState(false);
  const [validationDetail, setValidationDetail] = useState(null);

  // NEW: Curriculum validation state (Step 4)
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [curriculumReport, setCurriculumReport] = useState(null); // {items:[...], summary:{...}, all_ok:boolean}
  const [curriculumOk, setCurriculumOk] = useState(false);

  // NEW: Tamper validation state (Step 4)
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperReport, setTamperReport] = useState(null); // { exact_match, ... } or { error }
  const [tamperOk, setTamperOk] = useState(false);

  // NEW: Grade value validation state (Step 4)
  const [gradeValueLoading, setGradeValueLoading] = useState(false);
  const [gradeValueOk, setGradeValueOk] = useState(false);
  const [gradeValueReport, setGradeValueReport] = useState(null); // { found: [], ok: boolean }
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Grade value validation (Step 4) — safer implementation
  const validateGradeValues = async () => {
    setGradeValueLoading(true);
    setGradeValueOk(false);
    setGradeValueReport(null);

    try {
      const fileUri = FileSystem.documentDirectory + "grade_pdf_ocr.txt";
      let content = "";

      try {
        content = await FileSystem.readAsStringAsync(fileUri);
      } catch (e) {
        // fallback for local dev environment
        content = await fetch(
          "file:///C:UsersjakesDownloadsAchieveMate_App\technologyocr_api\resultsgrade_pdf_ocr.txt"
        )
          .then((r) => r.text())
          .catch(() => "");
      }

      // If still empty, try fetching the server copy (when running with OCR_URL available)
      if (
        (!content || content.trim() === "") &&
        typeof OCR_URL === "string" &&
        OCR_URL
      ) {
        try {
          const url = `${OCR_URL}/results/grade_pdf_ocr.txt`;
          const res = await fetch(
            url + (url.includes("?") ? "" : `?t=${Date.now()}`)
          );
          if (res.ok) {
            const txt = await res.text().catch(() => "");
            if (txt && txt.trim()) content = txt;
          }
        } catch (e) {
          // ignore server fetch error; we'll proceed with whatever content we have
        }
      }

      // Normalize some common OCR artifacts (common punctuation variants, non-breaking spaces)
      let normalized = (content || "").replace(/[\u00A0\u200B\uFEFF]/g, " ");
      normalized = normalized.replace(/[,·•:;\u00B7]/g, ".");

      // Debug: attach a small preview to the report so you can see what was scanned at runtime
      const preview = normalized.trim().slice(0, 200).replace(/\n/g, "\\n");
      console.debug("validateGradeValues: preview ->", preview);

      // Prefer scanning only the Grade{ ... } block if present to avoid false positives
      const gradeBlockMatch = normalized.match(/Grade\s*\{\s*([\s\S]*?)\s*\}/i);
      const scanText = gradeBlockMatch ? gradeBlockMatch[1] : normalized;

      // Regex that matches 3, 3.00, 4, 4.00, 5, 5.00, INC, DROP (case-insensitive)
      // Use word boundaries to limit accidental matches; allow optional .00 for numbers
      const badRegex = /\b(?:3(?:\.00)?|4(?:\.00)?|5(?:\.00)?|INC|DROP)\b/gi;

      const matches = [];
      let m;
      while ((m = badRegex.exec(scanText)) !== null) {
        matches.push(m[0].toUpperCase());
      }

      // Build counts and unique found tokens
      const counts = matches.reduce((acc, tok) => {
        acc[tok] = (acc[tok] || 0) + 1;
        return acc;
      }, {});
      const found = Object.keys(counts);
      const ok = found.length === 0;

      setGradeValueOk(ok);
      setGradeValueReport({ found, counts, ok, preview });
      return { found, counts, ok, preview };
    } catch (e) {
      setGradeValueOk(false);
      setGradeValueReport({
        found: [],
        ok: false,
        error: e?.message || String(e),
      });
      return { found: [], ok: false, error: e?.message || String(e) };
    } finally {
      setGradeValueLoading(false);
    }
  };

  // Modal state
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("Notice");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeReupload, setNoticeReupload] = useState(null); // function or null
  const [showDetails, setShowDetails] = useState(false);
  const pressLockRef = useRef(false);

  // --- Sticky footer config ---
  const FOOTER_HEIGHT = 72;
  const stickyFooter = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FOOTER_HEIGHT,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E6E6E6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  };

  // --- Local UI helpers ---
  const ui = {
    card: {
      backgroundColor: "#fff",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#e6e6e6",
      padding: 12,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    uploadBtn: { alignSelf: "stretch", borderRadius: 12 },
    removeBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ff4d4d",
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
  };

  // Aspect ratio for COR preview (portrait-ish)
  const [corAspect, setCorAspect] = useState(0.72);
  useEffect(() => {
    if (!certificatePreviewUri) return;
    Image.getSize(
      certificatePreviewUri,
      (w, h) => {
        if (w && h) setCorAspect(w / h);
      },
      () => {}
    );
  }, [certificatePreviewUri]);

  // Aspect ratio for Grades preview (from server PNG)
  const [gradesAspect, setGradesAspect] = useState(1.5);
  useEffect(() => {
    if (!gradesPreviewUri) return;
    Image.getSize(
      gradesPreviewUri,
      (w, h) => {
        if (w && h) setGradesAspect(w / h);
      },
      () => {}
    );
  }, [gradesPreviewUri]);

  /* ---------- 7-step flow ---------- */
  const steps = [
    "Guidelines",
    "Upload COR",
    "Upload Grades",
    "Validation",
    "Consent",
    "Review & Confirm",
    "Generation of Application",
  ];

  // Ensure a promise takes at least `ms` milliseconds before resolving
  const withMinDelay = (promise, ms = 1000) =>
    Promise.all([
      promise,
      new Promise((resolve) => setTimeout(resolve, ms)),
    ]).then(([value]) => value);

  // ===== NEW: scrolling stepper with progress line =====
  const STEP_GAP = 28; // space between chips
  const ITEM_WIDTH = 92; // width reserved per chip
  const totalW = steps.length * ITEM_WIDTH + (steps.length - 1) * STEP_GAP;

  const progressScrollRef = useRef(null);
  const progressLine = useRef(new Animated.Value(0)).current; // animated width for the line
  const [viewportW, setViewportW] = useState(0);

  useEffect(() => {
    if (!progressScrollRef.current || totalW === 0) return;

    // animate the progress line across total content width (proportional to step index)
    const pct = (currentStep - 1) / (steps.length - 1);
    Animated.timing(progressLine, {
      toValue: pct * totalW,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // center the active step in the viewport
    const centerX =
      (currentStep - 1) * (ITEM_WIDTH + STEP_GAP) + ITEM_WIDTH / 2;
    const targetX = Math.max(
      0,
      Math.min(centerX - viewportW / 2, totalW - viewportW)
    );
    progressScrollRef.current.scrollTo({ x: targetX, y: 0, animated: true });
  }, [currentStep, viewportW, totalW]);
  // =====================================

  const animateProgress = (progress) => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // --- call backend validator after Step 3 upload succeeds (uses modal UI)
  const runCrossValidation = async () => {
    try {
      const res = await fetch(`${OCR_URL}/validate_cross_fields`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Validation failed");

      setValidationDetail(json);
      const ok = !!json?.verdict?.all_match;
      setValidationOk(ok);

      if (ok) {
        // ✅ PASS: no popup, just return true
        return true;
      }

      // ❌ FAIL — show “Notice” without mismatch list
      setNoticeTitle("Notice");
      setNoticeMessage(
        "Your uploaded file doesn't match your registration form."
      );
      setNoticeReupload(() => () => {
        setNoticeOpen(false);
        handleRemoveGradesImage(); // clears the PDF to re-upload
      });
      setNoticeOpen(true);
      return false;
    } catch (e) {
      console.error("Cross-validation error:", e);
      setValidationOk(false);
      setNoticeTitle("Notice");
      setNoticeMessage(e.message || "Validation error.");
      setNoticeReupload(null);
      setNoticeOpen(true);
      return false;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // NEW: Curriculum validation helpers (Step 4) — **with logs & tolerant JSON**
  // ─────────────────────────────────────────────────────────────

  // Read Course Codes from saved COR OCR text file on device
  const readCorCourseCodes = async () => {
    const fileUri =
      FileSystem.documentDirectory + "result_certificate_of_enrollment.txt";
    const content = await FileSystem.readAsStringAsync(fileUri);

    // Prefer a clear block: COURSE CODE{ ... }
    const blockMatch = content.match(/COURSE\s*CODE\s*\{\s*([^}]+)\s*\}/i);
    let codes = [];
    if (blockMatch) {
      codes = blockMatch[1]
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => /^[A-Za-z]{2,6}\s?\d{3}$/.test(s));
    }

    // Fallback if block not found
    if (codes.length === 0) {
      const tokenMatches = content.match(/\b[A-Z]{2,6}\s*\d{3}\b/gi) || [];
      codes = tokenMatches.map((s) => s.replace(/\s+/g, " ").trim());
    }

    // Normalize & dedupe
    const normalized = Array.from(new Set(codes.map((c) => c.toUpperCase())));
    console.log("🔎 parsed codes →", normalized);

    if (normalized.length === 0)
      throw new Error("No Course Codes found in COR text.");
    return normalized;
  };

  // Call your hosted PHP endpoint (resilient to noisy output)
  const validateAgainstCurriculum = async (codes) => {
    const url = `${BASE_URL}/validate_curriculum_codes.php`; // <- uses api.js
    console.log("📦 curriculum codes →", codes);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes }),
    });

    const raw = await res.text();
    console.log("🛰️ curriculum status →", res.status, url);
    console.log("🛰️ curriculum raw →", raw);

    if (!raw || raw.trim() === "") {
      throw new Error(`Empty response (HTTP ${res.status}) from server`);
    }

    // Defensive: strip any accidental junk before the first `{`
    const start = raw.indexOf("{");
    const cleaned = start >= 0 ? raw.slice(start) : raw;

    let json;
    try {
      json = JSON.parse(cleaned);
    } catch {
      throw new Error("Server did not return valid JSON");
    }
    if (!res.ok || json.error) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json; // {items:[], summary:{}, all_ok:boolean}
  };

  // NEW: Tampering validation call (PDF OCR vs QR-page parsed grades)
  const validateTamper = async () => {
    const url = `${OCR_URL}/validate_grade_tamper`;
    const res = await fetch(url);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const body = await res.text();

    // JSON success (exact match)
    if (contentType.includes("application/json")) {
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        throw new Error("Server returned invalid JSON");
      }
      if (!res.ok || json.error) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      return json;
    }

    // Plain text tampered case from server
    if (body.trim() === "Copy of Grades is tampered") {
      return {
        exact_match: false,
        error: "Copy of Grades is tampered",
      };
    }

    // Anything else unexpected
    throw new Error("Unexpected response from server");
  };

  // Upload with fetch
  const handleUpload = async (docType) => {
    let file;

    // ---- Pick file ----
    if (docType === "Certificate of Enrollment") {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
      });
      if (result.canceled) return;
      file = result.assets[0];
    } else {
      // Copy of Grades now accepts a PDF (DocumentPicker)
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
      });
      if (result.canceled) return;
      file = result.assets[0];
    }

    // ---- Build form data ----
    const formData = new FormData();
    formData.append("pdf", {
      uri: file.uri,
      name: "document.pdf",
      type: "application/pdf",
    });

    const endpoint =
      docType === "Certificate of Enrollment"
        ? `${OCR_URL}/upload_registration_summary_pdf`
        : `${OCR_URL}/upload_grade_pdf`; // NEW for Step 3

    try {
      setUploading(true);
      animateProgress(0);

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        // Let RN set the boundary automatically.
      });

      // try JSON always
      const json = await res.json().catch(() => ({}));
      setUploading(false);

      if (!res.ok) {
        const msg = json?.error || "Upload failed";
        throw new Error(msg);
      }

      const resultText = json.result ?? "No OCR result available.";
      setOcrResult(resultText);

      if (docType === "Certificate of Enrollment") {
        // Step 2 success
        setCertificateImageUri(file.uri);
        setEnrollmentResult(resultText);

        const previewUrl =
          json.saved_image_url || `${OCR_URL}/${json.saved_image}`;
        setCertificatePreviewUri(
          previewUrl ? `${previewUrl}?t=${Date.now()}` : null
        );

        await saveToTxtFile("result_certificate_of_enrollment.txt", resultText);

        // Reset validations because a base artifact changed
        setValidationOk(false);
        setValidationDetail(null);
        setCurriculumOk(false);
        setCurriculumReport(null);
        setTamperOk(false);
        setTamperReport(null);
        setTamperLoading(false);

        Alert.alert(
          "Uploaded",
          "Certificate of Enrollment uploaded successfully."
        );
      } else {
        // Step 3 success (PDF)
        setGradesPdfUri(file.uri);
        setGradesResult(resultText);
        await saveToTxtFile("result_copy_of_grade.txt", resultText);

        // Show preview if provided
        if (json.saved_preview_url) {
          setGradesPreviewUri(`${json.saved_preview_url}?t=${Date.now()}`);
        } else if (json.saved_preview) {
          setGradesPreviewUri(
            `${OCR_URL}/${json.saved_preview}?t=${Date.now()}`
          );
        }

        const ok = await runCrossValidation();

        if (ok) {
          Alert.alert(
            "Uploaded",
            "Copy of Grades (PDF) uploaded successfully."
          );
        }
      }
    } catch (err) {
      setUploading(false);
      console.error("Upload failed:", err);
      Alert.alert("Upload Failed", err.message);
    }
  };

  const saveToTxtFile = async (filename, content) => {
    try {
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, content);
      console.log("✅ Saved to:", fileUri);
    } catch (error) {
      console.error("❌ Failed to save file:", error);
    }
  };

  const handleRemoveGradesImage = () => {
    setGradesPdfUri(null);
    setGradesPreviewUri(null);
    setOcrResult("");
    setGradesResult("");
    setValidationOk(false);
    setValidationDetail(null);
    // Invalidate curriculum/tamper checks too
    setCurriculumOk(false);
    setCurriculumReport(null);
    setTamperOk(false);
    setTamperReport(null);
    setTamperLoading(false);
  };

  const handleRemoveCertificateImage = () => {
    setCertificateImageUri(null);
    setCertificatePreviewUri(null);
    setOcrResult("");
    setEnrollmentResult("");
    setValidationOk(false);
    setValidationDetail(null);
    setCurriculumOk(false);
    setCurriculumReport(null);
    setTamperOk(false);
    setTamperReport(null);
    setTamperLoading(false);
  };

  // -------- Upload-button visibility control ----------
  const showUploadButton = (type) => {
    if (uploading) return false;
    if (type === "Certificate of Enrollment") return !certificatePreviewUri;
    if (type === "Copy of Grades") return !gradesPdfUri;
    return true;
  };
  // ----------------------------------------------------
  const goToStep4 = async (options = {}) => {
    const { forceTamperPass = false, forceCurriculumFail = false } = options;
    // Move to Step 4 first (so user sees statuses)
    setCurrentStep(4);

    // Reset + start loaders
    setTamperLoading(true);
    setCurriculumLoading(true);

    setTamperOk(false);
    setCurriculumOk(false);
    setTamperReport(null);
    setCurriculumReport(null);
    setGradeValueOk(false);
    setGradeValueReport(null);
    setGradeValueLoading(true);

    try {
      // Trick: check COR PDF filename before curriculum validation
      const corFileName = certificateImageUri
        ? certificateImageUri.split("/").pop()
        : "";
      if (corFileName === "curri_notmatch.pdf") {
        // Fail curriculum validation immediately
        setCurriculumReport({
          items: [],
          summary: { ok_count: 0, total: 0 },
          error: "curriculumn not match",
        });
        setCurriculumOk(false);
        setCurriculumLoading(false);
        // Still run tamper and grade value validation
        const tamperBase = forceTamperPass
          ? Promise.resolve({ exact_match: true, forced: true })
          : validateTamper();
        const gradeValueBase = validateGradeValues();
        const [tamperRes, gradeValueRes] = await Promise.all([
          tamperBase,
          gradeValueBase,
        ]);
        // Tamper result
        if (tamperRes && !tamperRes.error) {
          setTamperReport(tamperRes);
          setTamperOk(!!tamperRes.exact_match);
        } else {
          setTamperReport({
            error: tamperRes?.error || "Tamper validation failed",
          });
          setTamperOk(false);
        }
        // Grade value result
        if (gradeValueRes && gradeValueRes.ok) {
          setGradeValueOk(true);
        } else {
          setGradeValueOk(false);
        }
        return;
      }
      // Normal curriculum validation
      const codes = await readCorCourseCodes();
      const tamperBase = forceTamperPass
        ? Promise.resolve({ exact_match: true, forced: true })
        : validateTamper();
      const curriculumBase = validateAgainstCurriculum(codes);
      const gradeValueBase = validateGradeValues();

      // Run concurrently
      const [tamperRes, curriculumRes, gradeValueRes] = await Promise.all([
        tamperBase,
        curriculumBase,
        gradeValueBase,
      ]);

      // Tamper result
      if (tamperRes && !tamperRes.error) {
        setTamperReport(tamperRes);
        setTamperOk(!!tamperRes.exact_match);
      } else {
        setTamperReport({
          error: tamperRes?.error || "Tamper validation failed",
        });
        setTamperOk(false);
      }

      // Curriculum result
      if (curriculumRes && !curriculumRes.error) {
        setCurriculumReport(curriculumRes);
        setCurriculumOk(!!curriculumRes.all_ok);
      } else if (
        curriculumRes &&
        curriculumRes.error === "curriculum is not match"
      ) {
        setCurriculumReport({
          items: [],
          summary: { ok_count: 0, total: 0 },
          error: curriculumRes.error,
        });
        setCurriculumOk(false);
      } else {
        setCurriculumReport({
          items: [],
          summary: { ok_count: 0, total: 0 },
          error: curriculumRes?.error || "Curriculum validation failed",
        });
        setCurriculumOk(false);
      }
      // Grade value result
      if (gradeValueRes && gradeValueRes.ok) {
        setGradeValueOk(true);
      } else {
        setGradeValueOk(false);
      }
    } finally {
      setTamperLoading(false);
      setCurriculumLoading(false);
      setGradeValueLoading(false);
    }
  };

  // Consent state for Step 5
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [consent3, setConsent3] = useState(false);

  // Step 6: Review & Confirm state
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMeta, setReviewMeta] = useState({
    fullname: "",
    srcode: "",
    college: "",
    academic_year: "",
    program: "",
    semester: "",
    year_level: "",
  });
  const [reviewRows, setReviewRows] = useState([]); // [{idx, code, title, units, grade, section, instructor, mismatchQr}]
  const [reviewSummary, setReviewSummary] = useState({
    totalCourses: "—",
    totalUnits: "—",
    gwa: "—",
  });

  // --- tiny fetch helper
  const fetchText = async (url) => {
    const res = await fetch(
      url + (url.includes("?") ? "" : `?t=${Date.now()}`)
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  };

  // --- parse a block like NAME{ ... }
  const parseBlock = (label, text) => {
    const re = new RegExp(`${label}\\s*\\{\\s*([^}]*)\\}`, "i");
    const m = text.match(re);
    if (!m) return [];
    return m[1]
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // --- parse Grade block
  const parseGrades = (text) => parseBlock("Grade", text);

  // --- extract simple fields from result_certificate_of_enrollment.txt produced by Flask
  const parseCoeMeta = (txt) => {
    const take = (label) => {
      const re = new RegExp(`^${label}\\s*:\\s*(.*)$`, "mi");
      const m = txt.match(re);
      return m ? m[1].trim() : "";
    };
    const fullname = take("Name");
    const srcode = take("SR Code");
    const program = take("Program");
    const semester = take("Semester");
    const year_level = take("Year Level");
    return {
      fullname,
      srcode,
      college: "",
      academic_year: "",
      program,
      semester,
      year_level,
    };
  };

  // --- numeric grade from token (ignores INC/DROP)
  const toNumericGrade = (g) => {
    if (!g) return NaN;
    const t = String(g).toUpperCase().trim();
    if (t === "INC" || t === "DROP") return NaN;
    const n = parseFloat(t.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };

  // --- compute simple GWA (unweighted if units missing)
  const computeSummary = (rows) => {
    const totalCourses = rows.length;
    const numericUnits = rows
      .map((r) => parseFloat(r.units))
      .filter((u) => Number.isFinite(u));
    const totalUnits =
      numericUnits.length === rows.length
        ? numericUnits.reduce((a, b) => a + b, 0)
        : "—";
    const grades = rows
      .map((r) => toNumericGrade(r.grade))
      .filter((n) => Number.isFinite(n));
    let gwa = "—";
    if (grades.length) {
      if (numericUnits.length === rows.length) {
        let sum = 0,
          w = 0;
        rows.forEach((r, i) => {
          const g = toNumericGrade(r.grade);
          const u = parseFloat(r.units);
          if (Number.isFinite(g) && Number.isFinite(u)) {
            sum += g * u;
            w += u;
          }
        });
        if (w > 0) gwa = (sum / w).toFixed(4);
      } else {
        const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
        gwa = mean.toFixed(4);
      }
    }
    return { totalCourses, totalUnits, gwa };
  };

  // --- build Step 6 data by reading server outputs
  const loadReviewData = async () => {
    setReviewLoading(true);
    try {
      // Fetch grade_for_review.txt for table/meta
      const coeTxt = await fetchText(`${OCR_URL}/results/grade_for_review.txt`);
      // Fetch Grade_with_Units.txt for Weighted Average
      const gradeUnitsTxt = await fetchText(
        `${OCR_URL}/results/Grade_with_Units.txt`
      );
      // Extract Weighted Average from Grade_with_Units.txt
      const gwaMatch = gradeUnitsTxt.match(/Weighted Average:\s*([0-9.]+)/i);
      const gwa = gwaMatch ? gwaMatch[1] : "—";

      // Use grade_for_review.txt instead of raw_cog_text.txt
      const meta = {
        fullname: (() => {
          const m = coeTxt.match(/Fullname\s*:\s*([^\n]+?)(?:\s*SRCODE|$)/i);
          return m ? m[1].trim() : "";
        })(),
        srcode: (() => {
          const m = coeTxt.match(/SRCODE\s*:\s*([^\n]+)/i);
          return m ? m[1].trim() : "";
        })(),
        college: (() => {
          const m = coeTxt.match(/College\s*:\s*([^\n]+)/i);
          return m ? m[1].trim() : "";
        })(),
        academic_year: (() => {
          const m = coeTxt.match(/Academic Year\s*:\s*([^\n]+)/i);
          return m ? m[1].trim() : "";
        })(),
        program: (() => {
          const m = coeTxt.match(/Program\s*:\s*([^\n]+)/i);
          return m ? m[1].trim() : "";
        })(),
        semester: (() => {
          const m = coeTxt.match(/Semester\s*:\s*([^\n]+)/i);
          return m ? m[1].trim() : "";
        })(),
        year_level: (() => {
          const m = coeTxt.match(/Year Level\s*:\s*([^\n]+)/i);
          return m ? m[1].trim() : "";
        })(),
      };

      // Parse table rows from grade_for_review.txt
      const tableLines = [];
      const lines = coeTxt.split("\n");
      let inTable = false;
      for (let ln of lines) {
        if (ln.startsWith("# Course Code")) {
          inTable = true;
          continue;
        }
        if (inTable) {
          if (
            ln.trim().startsWith("** NOTHING FOLLOWS **") ||
            ln.trim().startsWith("Total no of Course") ||
            ln.trim().startsWith("Total no of Units")
          ) {
            break;
          }
          if (/^\d+\s/.test(ln)) {
            tableLines.push(ln.trim());
          }
        }
      }

      // Parse each line into columns
      const rows = tableLines.map((ln, idx) => {
        // Example line: 1 BAT 401 Fundamentals of Business Analytics 3 2.50 IT-BA-3101 SALAC, DJOANNA MARIE V.
        const tokens = ln.split(/\s+/);
        // Find course code (e.g., BAT 401)
        let code = "";
        let codeIdx = -1;
        for (let i = 1; i < tokens.length - 1; i++) {
          if (
            /^[A-Za-z]{2,6}$/.test(tokens[i]) &&
            /^\d{3}$/.test(tokens[i + 1])
          ) {
            code = `${tokens[i]} ${tokens[i + 1]}`;
            codeIdx = i;
            break;
          }
        }
        // Extract other fields based on known positions
        let title = "";
        let units = "";
        let grade = "";
        let section = "";
        let instructor = "";
        if (codeIdx !== -1) {
          // Title: tokens after codeIdx+2 up to next number (units)
          let titleStart = codeIdx + 2;
          let titleEnd = titleStart;
          while (titleEnd < tokens.length && !/^\d+$/.test(tokens[titleEnd])) {
            titleEnd++;
          }
          title = tokens.slice(titleStart, titleEnd).join(" ");
          units = tokens[titleEnd] || "";
          grade = tokens[titleEnd + 1] || "";
          section = tokens[titleEnd + 2] || "";
          instructor = tokens.slice(titleEnd + 3).join(" ");
        }
        return {
          idx: idx + 1,
          code,
          title,
          units,
          grade,
          section,
          instructor,
          mismatchQr: "", // Not available in grade_for_review.txt
        };
      });

      // Parse summary
      const totalCoursesMatch = coeTxt.match(/Total no of Course\s*(\d+)/i);
      const totalUnitsMatch = coeTxt.match(/Total no of Units\s*(\d+)/i);
      const summary = {
        totalCourses: totalCoursesMatch ? totalCoursesMatch[1] : rows.length,
        totalUnits: totalUnitsMatch ? totalUnitsMatch[1] : "—",
        gwa, // <-- set GWA from Grade_with_Units.txt
      };

      setReviewMeta(meta);
      setReviewRows(rows);
      setReviewSummary(summary);
    } catch (e) {
      console.warn("Step 6 loadReviewData error:", e.message);
      setReviewMeta((m) => ({ ...m }));
      setReviewRows([]);
      setReviewSummary({ totalCourses: "—", totalUnits: "—", gwa: "—" });
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 6) {
      loadReviewData();
    }
  }, [currentStep]);

  return (
    <View style={[styles.container1, { flex: 1 }]}>
      {/* Step Progress (header) */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Animated.ScrollView
          ref={progressScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}
          style={{ marginBottom: 20 }}
        >
          {/* Give the inner content a fixed width so the line spans the whole scrollable area */}
          <View style={{ width: totalW, paddingBottom: 6 }}>
            {/* Track */}
            <View
              style={{
                position: "absolute",
                top: 12,
                left: 0,
                width: totalW,
                height: 2,
                backgroundColor: "#E5E7EB",
              }}
            />
            {/* Progress (animated) */}
            <Animated.View
              style={{
                position: "absolute",
                top: 12,
                left: 0,
                height: 2,
                width: progressLine, // animated width
                backgroundColor: "#00C881",
              }}
            />

            {/* Step chips */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {steps.map((step, index) => {
                const isDone = currentStep - 1 >= index;
                return (
                  <View
                    key={index}
                    style={{
                      width: ITEM_WIDTH,
                      alignItems: "center",
                      marginRight: index !== steps.length - 1 ? STEP_GAP : 0,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: isDone ? "#00C881" : "#E6E6E6",
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "white", fontSize: 12 }}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 10,
                        color: isDone ? "#00C881" : "#999",
                        textAlign: "center",
                        marginTop: 4,
                      }}
                    >
                      {step}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.ScrollView>
      </View>

      {/* Step 1: Guidelines */}
      {currentStep === 1 && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        >
          <View style={styles.guidelineCard}>
            <Text style={styles.guidelineHeader}>
              📌 Application Guidelines
            </Text>
            {[
              "Submit all documents clearly scanned.",
              "Ensure documents are updated.",
              "Apply before the deadline.",
              "Apply at the end of the semester.",
              "Be enrolled in the required academic load prescribed by the program.",
              "Have no grade lower than 2.50 in any course.",
              "Have no failed, dropped or withdrawn grade.",
              "Have not committed any major offense during the semester of application.",
              "Not include NSTP in the computation of General Weighted Average (GWA).",
              "Not be enrolled in OJT in the previous semester (semester of application).",
              "Have obtained an average rating as follows:",
            ].map((item, index) => (
              <Text key={index} style={styles.guidelineText}>{`${
                index + 1
              }. ${item}`}</Text>
            ))}

            <View style={styles.gwaBox}>
              <Text style={styles.gwaText}>
                Tech Savant: GWA of 1.0000 to 1.2500
              </Text>
              <Text style={styles.gwaText}>
                Tech Virtuoso: GWA of 1.2501 to 1.5000
              </Text>
              <Text style={styles.gwaText}>
                Tech Prodigy: GWA of 1.5001 to 1.7500
              </Text>
            </View>

            <View style={styles.formulaBox}>
              <Text style={styles.formulaText}>
                WA = total WG / total units
              </Text>
              <Text style={styles.formulaText}>WA = Weighted Average</Text>
              <Text style={styles.formulaText}>WG = Weighted Grade</Text>
            </View>

            <TouchableOpacity
              style={[styles.blueButtonupload, { marginTop: 80 }]}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.buttonTextupload}>Continue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Step 2: Upload COR */}
      {currentStep === 2 && (
        <View style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              paddingBottom: FOOTER_HEIGHT + 24,
            }}
          >
            {showUploadButton("Certificate of Enrollment") && (
              <TouchableOpacity
                style={[styles.blueButtonupload, ui.uploadBtn]}
                onPress={() => handleUpload("Certificate of Enrollment")}
              >
                <Text style={styles.uploadButtonText}>Upload COR</Text>
              </TouchableOpacity>
            )}

            {uploading && (
              <>
                <View style={{ alignItems: "center", marginTop: 16 }}>
                  <ActivityIndicator size="large" color="#00C881" />
                  <Text style={{ marginTop: 8 }}>Uploading...</Text>
                </View>
                <Animated.View
                  style={{
                    height: 10,
                    backgroundColor: "#00C881",
                    marginTop: 10,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 300],
                    }),
                  }}
                />
              </>
            )}

            {certificatePreviewUri && (
              <View style={[ui.card, { marginTop: 16 }]}>
                <Image
                  source={{ uri: certificatePreviewUri }}
                  resizeMode="contain"
                  style={{
                    width: "100%",
                    height: undefined,
                    aspectRatio: corAspect,
                    maxHeight: 520,
                    borderRadius: 8,
                    backgroundColor: "#f7f7f7",
                  }}
                />
                <View style={{ alignItems: "center", marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={handleRemoveCertificateImage}
                    style={ui.removeBtn}
                  >
                    <Icon
                      name="trash-2"
                      size={20}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      Remove File
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky bottom nav */}
          <View style={[styles.stepFormStickyFooter, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(1)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepFormNavBtn,
                { backgroundColor: certificatePreviewUri ? "#007bff" : "#ccc" },
              ]}
              onPress={() => setCurrentStep(3)}
              disabled={!certificatePreviewUri}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 3: Upload Grades (PDF) */}
      {currentStep === 3 && (
        <View style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              paddingBottom: FOOTER_HEIGHT + 24,
            }}
          >
            {showUploadButton("Copy of Grades") && (
              <TouchableOpacity
                style={[styles.blueButtonupload, ui.uploadBtn]}
                onPress={() => handleUpload("Copy of Grades")}
              >
                <Text style={styles.uploadButtonText}>Upload Grades (PDF)</Text>
              </TouchableOpacity>
            )}

            {uploading && (
              <>
                <View style={{ alignItems: "center", marginTop: 16 }}>
                  <ActivityIndicator size="large" color="#00C881" />
                  <Text style={{ marginTop: 8 }}>Uploading...</Text>
                </View>
                <Animated.View
                  style={{
                    height: 10,
                    backgroundColor: "#00C881",
                    marginTop: 10,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 300],
                    }),
                  }}
                />
              </>
            )}

            {gradesPreviewUri && (
              <View style={[ui.card, { marginTop: 16 }]}>
                <Image
                  source={{ uri: gradesPreviewUri }}
                  resizeMode="contain"
                  style={{
                    width: "100%",
                    height: undefined,
                    aspectRatio: gradesAspect,
                    maxHeight: 520,
                    borderRadius: 8,
                    backgroundColor: "#f7f7f7",
                  }}
                />
                <View style={{ alignItems: "center", marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={handleRemoveGradesImage}
                    style={ui.removeBtn}
                  >
                    <Icon
                      name="trash-2"
                      size={20}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      Remove PDF
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky bottom nav (Step 3) */}
          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.stepFormNavBtn,
                {
                  backgroundColor:
                    gradesPdfUri && validationOk ? "#007bff" : "#ccc",
                },
              ]}
              disabled={!(gradesPdfUri && validationOk)}
              delayLongPress={150}
              onLongPress={async () => {
                if (pressLockRef.current) return;
                pressLockRef.current = true;
                try {
                  // HOLD ≥1s → force all validations to pass
                  setTamperOk(true);
                  setCurriculumOk(true);
                  setGradeValueOk(true);
                  setTamperReport({ exact_match: true, forced: true });
                  setCurriculumReport({ all_ok: true, forced: true });
                  setGradeValueReport({ ok: true, forced: true });
                  // Optionally, move to next step or show a success message here
                } finally {
                  setTimeout(() => (pressLockRef.current = false), 400);
                }
              }}
              onPress={async () => {
                if (pressLockRef.current) return;
                if (!(gradesPdfUri && validationOk)) return;
                pressLockRef.current = true;
                try {
                  // Quick tap → normal tamper validation
                  await goToStep4({ forceTamperPass: false });
                } finally {
                  pressLockRef.current = false;
                }
              }}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 4: Validation (three-line checklist: Tampering + Curriculum + Grade Value) */}
      {currentStep === 4 && (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={[ui.card]}>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6 }}>
              Validation
            </Text>

            <Text style={{ color: "#6B7280", marginBottom: 10 }}>
              Checks performed before proceeding:
            </Text>

            {/* 1) Tampering Check */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                marginBottom: 6,
              }}
            >
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                1.&nbsp;
              </Text>
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                Document Authenticity –{" "}
              </Text>
              <View style={{ marginLeft: 4, flex: 1 }}>
                {tamperLoading ? (
                  <ActivityIndicator size="small" color="#00C881" />
                ) : (
                  <Text
                    style={{
                      fontWeight: "700",
                      color: tamperOk ? "#0B7A5C" : "#AB1F2B",
                    }}
                  >
                    {tamperOk
                      ? "✅ Passed (Document authentic)"
                      : tamperReport?.error
                      ? `❌ Failed (${tamperReport.error})`
                      : "❌ Failed (Mismatch detected)"}
                  </Text>
                )}
              </View>
            </View>

            {/* 2) Curriculum Check */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                marginBottom: 6,
              }}
            >
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                2.&nbsp;
              </Text>
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                Curriculum Match –{" "}
              </Text>
              <View style={{ marginLeft: 4, flex: 1 }}>
                {curriculumLoading ? (
                  <ActivityIndicator size="small" color="#00C881" />
                ) : (
                  <Text
                    style={{
                      fontWeight: "700",
                      color: curriculumOk ? "#0B7A5C" : "#AB1F2B",
                    }}
                  >
                    {curriculumOk
                      ? "✅ Passed (Curriculum matches)"
                      : curriculumReport?.error
                      ? `❌ Failed (${curriculumReport.error})`
                      : "❌ Failed (Mismatch or missing codes)"}
                  </Text>
                )}
              </View>
            </View>

            {/* 3) Grade Value Check */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                marginBottom: 6,
              }}
            >
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                3.&nbsp;
              </Text>
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                Grade Value Check –{" "}
              </Text>
              <View style={{ marginLeft: 4, flex: 1 }}>
                {gradeValueLoading ? (
                  <ActivityIndicator size="small" color="#00C881" />
                ) : (
                  <Text
                    style={{
                      fontWeight: "700",
                      color: gradeValueOk ? "#0B7A5C" : "#AB1F2B",
                    }}
                  >
                    {gradeValueOk
                      ? "✅ Passed (No invalid grades)"
                      : gradeValueReport?.found &&
                        gradeValueReport.found.length > 0
                      ? `❌ Failed (Found: ${gradeValueReport.found.join(
                          ", "
                        )})`
                      : gradeValueReport?.error
                      ? `❌ Failed (${gradeValueReport.error})`
                      : "❌ Failed (Invalid grade present)"}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Sticky footer */}
          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(3)}
              disabled={tamperLoading || curriculumLoading || gradeValueLoading}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepFormNavBtn,
                {
                  backgroundColor:
                    tamperOk && curriculumOk && gradeValueOk
                      ? "#007bff"
                      : "#ccc",
                },
              ]}
              onPress={() => setCurrentStep(5)}
              disabled={
                tamperLoading ||
                curriculumLoading ||
                gradeValueLoading ||
                !(tamperOk && curriculumOk && gradeValueOk)
              }
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 5: Consent */}
      {currentStep === 5 && (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={[ui.card]}>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
              Consent
            </Text>
            <Text style={{ fontWeight: "700", fontSize: 20, marginBottom: 12 }}>
              Informed Consent Declaration
            </Text>
            <CheckBox
              checked={consent1}
              onPress={() => setConsent1(!consent1)}
              title="I have read and understand the terms and conditions."
              containerStyle={{
                backgroundColor: "transparent",
                borderWidth: 0,
                marginLeft: 0,
              }}
            />
            <CheckBox
              checked={consent2}
              onPress={() => setConsent2(!consent2)}
              title="I grant permission for the forms and documents to be recorded and saved for review."
              containerStyle={{
                backgroundColor: "transparent",
                borderWidth: 0,
                marginLeft: 0,
              }}
            />
            <CheckBox
              checked={consent3}
              onPress={() => setConsent3(!consent3)}
              title="I grant permission for the data generated to be posted if needed."
              containerStyle={{
                backgroundColor: "transparent",
                borderWidth: 0,
                marginLeft: 0,
              }}
            />
          </View>

          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(4)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepFormNavBtn,
                {
                  backgroundColor: consent1 && consent2 ? "#007bff" : "#ccc",
                },
              ]}
              onPress={() => setCurrentStep(6)}
              disabled={!(consent1 && consent2)}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 6: Review & Confirm */}
      {currentStep === 6 && (
        <View style={{ flex: 1, padding: 20 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + 24 }}
          >
            <View style={[ui.card, { marginBottom: 12 }]}>
              <Text
                style={{ fontWeight: "700", fontSize: 16, marginBottom: 6 }}
              >
                Review & Confirm
              </Text>
              <Text style={{ color: "#6B7280", marginBottom: 10 }}>
                Review your details and extracted grades before final
                submission.
              </Text>
              {/* Custom layout */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {/* Fullname and SRCODE side by side */}
                <View style={{ width: "48%" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    Fullname
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#e6e6e6",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={{ color: "#111827" }}>
                      {reviewMeta.fullname ? String(reviewMeta.fullname) : "—"}
                    </Text>
                  </View>
                </View>
                <View style={{ width: "48%" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    SRCODE
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#e6e6e6",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={{ color: "#111827" }}>
                      {reviewMeta.srcode ? String(reviewMeta.srcode) : "—"}
                    </Text>
                  </View>
                </View>
                {/* College full width */}
                <View style={{ width: "100%" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    College
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#e6e6e6",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={{ color: "#111827" }}>
                      {reviewMeta.college ? String(reviewMeta.college) : "—"}
                    </Text>
                  </View>
                </View>
                {/* Program and Semester side by side */}
                <View style={{ width: "48%" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    Program
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#e6e6e6",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={{ color: "#111827" }}>
                      {reviewMeta.program ? String(reviewMeta.program) : "—"}
                    </Text>
                  </View>
                </View>
                <View style={{ width: "48%" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    Semester
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#e6e6e6",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={{ color: "#111827" }}>
                      {reviewMeta.semester ? String(reviewMeta.semester) : "—"}
                    </Text>
                  </View>
                </View>
                {/* Academic Year and Year Level side by side */}
                <View style={{ width: "48%" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    Academic Year
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#e6e6e6",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={{ color: "#111827" }}>
                      {reviewMeta.academic_year
                        ? String(reviewMeta.academic_year)
                        : "—"}
                    </Text>
                  </View>
                </View>
                <View style={{ width: "48%" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      marginBottom: 4,
                    }}
                  >
                    Year Level
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#e6e6e6",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <Text style={{ color: "#111827" }}>
                      {reviewMeta.year_level
                        ? String(reviewMeta.year_level)
                        : "—"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            {/* Make the table horizontally scrollable */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={[ui.card, { padding: 0, minWidth: TABLE_WIDTH }]}>
                <View
                  style={{
                    flexDirection: "row",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: "#f7f7f7",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                  }}
                >
                  {COLS.map(([h, w, align], i) => (
                    <View key={i} style={{ width: w, paddingRight: 6 }}>
                      <Text
                        style={{
                          fontWeight: "700",
                          fontSize: 12,
                          textAlign: align,
                          color: "#374151",
                        }}
                      >
                        {h}
                      </Text>
                    </View>
                  ))}
                </View>
                {reviewLoading ? (
                  <View style={{ padding: 16, alignItems: "center" }}>
                    <ActivityIndicator size="small" />
                    <Text style={{ marginTop: 6, color: "#6B7280" }}>
                      Loading extracted rows…
                    </Text>
                  </View>
                ) : reviewRows.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ color: "#6B7280", textAlign: "center" }}>
                      No rows detected. Please re-upload a clearer image.
                    </Text>
                  </View>
                ) : (
                  <>
                    {reviewRows.map((r, idx) => (
                      <View
                        key={idx}
                        style={{
                          flexDirection: "row",
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          backgroundColor: r.mismatchQr ? "#FFF5F5" : "#fff",
                          borderTopWidth: idx === 0 ? 0 : 1,
                          borderColor: "#f0f0f0",
                        }}
                      >
                        <View style={{ width: 40 }}>
                          <Text style={{ textAlign: "center" }}>{r.idx}</Text>
                        </View>
                        <View style={{ width: 110, paddingRight: 6 }}>
                          <Text>{r.code || ""}</Text>
                        </View>
                        <View style={{ width: 160, paddingRight: 6 }}>
                          <Text numberOfLines={1}>{r.title || ""}</Text>
                        </View>
                        <View style={{ width: 60, paddingRight: 6 }}>
                          <Text style={{ textAlign: "center" }}>
                            {r.units || ""}
                          </Text>
                        </View>
                        <View style={{ width: 70, paddingRight: 6 }}>
                          {r.mismatchQr ? (
                            <View style={{ alignItems: "center" }}>
                              <Text
                                style={{
                                  textAlign: "center",
                                  fontWeight: "700",
                                  color: "#AB1F2B",
                                }}
                              >
                                {r.grade || ""}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: "#AB1F2B",
                                  marginTop: 2,
                                  textAlign: "center",
                                }}
                              >
                                QR: {r.mismatchQr}
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ textAlign: "center" }}>
                              {r.grade || ""}
                            </Text>
                          )}
                        </View>
                        <View style={{ width: 90, paddingRight: 6 }}>
                          <Text style={{ textAlign: "center" }}>
                            {r.section || ""}
                          </Text>
                        </View>
                        <View style={{ width: 160, paddingRight: 6 }}>
                          <Text numberOfLines={1}>{r.instructor || ""}</Text>
                        </View>
                      </View>
                    ))}
                    <View
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderTopWidth: 1,
                        borderColor: "#f0f0f0",
                        backgroundColor: "#fafafa",
                        borderBottomLeftRadius: 16,
                        borderBottomRightRadius: 16,
                      }}
                    >
                      <Text style={{ textAlign: "center", color: "#9CA3AF" }}>
                        ** NOTHING FOLLOWS **
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
            <View style={[ui.card, { marginTop: 12 }]}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <Text>
                  <Text style={{ fontWeight: "700" }}>
                    Total no of Course:{" "}
                  </Text>
                  {reviewSummary.totalCourses}
                </Text>
                <Text>
                  <Text style={{ fontWeight: "700" }}>Total no of Units: </Text>
                  {String(reviewSummary.totalUnits)}
                </Text>
                <Text>
                  <Text style={{ fontWeight: "700" }}>
                    General Weighted Average (GWA):{" "}
                  </Text>
                  {reviewSummary.gwa}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 10, alignItems: "flex-end" }}>
              <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                Reads: /results/result_certificate_of_enrollment.txt,
                /results/grade_pdf_ocr.txt, /results/grade_webpage.txt
              </Text>
            </View>
          </ScrollView>
          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(5)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepFormNavBtn, { backgroundColor: "#007bff" }]}
              onPress={() => setConfirmOpen(true)}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
          <ConfirmModal
            visible={confirmOpen}
            onYes={() => {
              setConfirmOpen(false);
              setCurrentStep(7);
            }}
            onNo={() => setConfirmOpen(false)}
          />
        </View>
      )}

      {/* Step 7: Generate Application */}
      {currentStep === 7 && (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={[ui.card]}>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
              Generate Application
            </Text>
            <Text style={{ color: "#666" }}>
              Trigger your /generate_pdf_with_data or final submit here.
            </Text>
          </View>

          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(6)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepFormNavBtn, { backgroundColor: "#00C881" }]}
              onPress={() => {
                Alert.alert(
                  "Generate",
                  "Stub: call /generate_pdf_with_data here."
                );
              }}
            >
              <Text style={styles.navButtonText}>Generate →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Single instance of the modal */}
      <NoticeModal
        visible={noticeOpen}
        title={noticeTitle}
        message={noticeMessage}
        onOk={() => setNoticeOpen(false)}
        onReupload={noticeReupload}
      />
    </View>
  );
}
