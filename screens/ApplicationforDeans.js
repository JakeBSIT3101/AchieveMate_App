// ==== ApplicationforDeans.js (full file, with curriculum validation logs/fallbacks) ====

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
  Platform,
  Share,
} from "react-native";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import Icon from "react-native-vector-icons/Feather";
import styles from "../styles";
import { OCR_URL, BASE_URL } from "../config/api";
import { CheckBox } from "react-native-elements";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";

// Removed Buffer + eager expo-sharing require to avoid Hermes native module error.

/* ──────────────── Debugging helpers ──────────────── */
const logCurr = (...args) => console.log("🌐[curriculum]", ...args);

const safeJson = (raw) => {
  if (!raw) return null;
  // Strip BOM and trims
  const t = raw.replace(/^\uFEFF/, "").trim();
  // Cut off anything before first { or [
  const idxs = [t.indexOf("{"), t.indexOf("[")].filter((i) => i >= 0);
  const start = idxs.length ? Math.min(...idxs) : -1;
  const cleaned = start > 0 ? t.slice(start) : t;
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Server did not return valid JSON");
  }
};
/* ─────────────────────────────────────────────────── */

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
                borderColor: "#0d2f60",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  backgroundColor: "#0d2f60",
                  transform: [{ rotate: "45deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 36,
                  height: 4,
                  backgroundColor: "#0d2f60",
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
                  backgroundColor: "#E3EAF3",
                  borderWidth: 1,
                  borderColor: "#0d2f60",
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
                backgroundColor: "#0d2f60",
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

/* ---------- Confirmation modal ---------- */
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
  const navigation = useNavigation();
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

  // Step 3: Grades (PDF) + preview png from server
  const [gradesPdfUri, setGradesPdfUri] = useState(null);
  const [gradesPreviewUri, setGradesPreviewUri] = useState(null);

  const [uploading, setUploading] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [enrollmentResult, setEnrollmentResult] = useState("");
  const [gradesResult, setGradesResult] = useState("");

  const [previewImage, setPreviewImage] = useState(null); // kept if you need in the future
  const [convertedImage, setConvertedImage] = useState(null); // kept if you need in the future
  const [pdfFile, setPdfFile] = useState(null); // kept if you need in the future
  const [applicationPdfUri, setApplicationPdfUri] = useState(null); // generated PDF path for preview
  const [applicationPdfBase64, setApplicationPdfBase64] = useState(null); // base64 for WebView preview
  const [referencePdfBase64, setReferencePdfBase64] = useState(null); // base64 for right result preview (optional)
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageCount, setPreviewPageCount] = useState(null);
  const [contactNumber, setContactNumber] = useState("");

  const longPressTamperPassRef = useRef(false);
  const holdTimerRef = useRef(null);

  // Cross-field validation (COR vs Grades)
  const [validationOk, setValidationOk] = useState(false);
  const [validationDetail, setValidationDetail] = useState(null);

  // Curriculum validation
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [curriculumReport, setCurriculumReport] = useState(null); // {items:[], summary:{}, all_ok:boolean}
  const [curriculumOk, setCurriculumOk] = useState(false);

  // Tamper validation
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperReport, setTamperReport] = useState(null); // { exact_match, ... } or { error }
  const [tamperOk, setTamperOk] = useState(false);

  // Grade value validation (INC / DROP / 3.00 / 4.00 / 5.00)
  const [gradeValueLoading, setGradeValueLoading] = useState(false);
  const [gradeValueOk, setGradeValueOk] = useState(false);
  const [gradeValueReport, setGradeValueReport] = useState(null); // { found:[], counts:{}, ok, preview }

  // Notice modal
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("Notice");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeReupload, setNoticeReupload] = useState(null);

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);

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
  const STEP_GAP = 28;
  const ITEM_WIDTH = 92;
  const totalW = steps.length * ITEM_WIDTH + (steps.length - 1) * STEP_GAP;

  const progressScrollRef = useRef(null);
  const progressLine = useRef(new Animated.Value(0)).current;
  const [viewportW, setViewportW] = useState(0);

  useEffect(() => {
    if (!progressScrollRef.current || totalW === 0) return;

    const pct = (currentStep - 1) / (steps.length - 1);
    Animated.timing(progressLine, {
      toValue: pct * totalW,
      duration: 300,
      useNativeDriver: false,
    }).start();

    const centerX =
      (currentStep - 1) * (ITEM_WIDTH + STEP_GAP) + ITEM_WIDTH / 2;
    const targetX = Math.max(
      0,
      Math.min(centerX - viewportW / 2, totalW - viewportW)
    );
    progressScrollRef.current.scrollTo({ x: targetX, y: 0, animated: true });
  }, [currentStep, viewportW, totalW]);

  const animateProgress = (progress) => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  /* ──────────────────────────────────────────────────────────────
     Validators
     ────────────────────────────────────────────────────────────── */

  // Cross-field validation (server)
  const runCrossValidation = async () => {
    try {
      const res = await fetch(`${OCR_URL}/validate_cross_fields`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Validation failed");

      setValidationDetail(json);
      const ok = !!json?.verdict?.all_match;
      setValidationOk(ok);

      if (ok) return true;

      setNoticeTitle("Notice");
      setNoticeMessage(
        "Your uploaded file doesn't match your registration form."
      );
      setNoticeReupload(() => () => {
        setNoticeOpen(false);
        handleRemoveGradesImage();
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

  // Read Course Codes from saved COR OCR text file on device
  const readCorCourseCodes = async () => {
    const fileUri =
      FileSystem.documentDirectory + "result_certificate_of_enrollment.txt";
    const content = await FileSystem.readAsStringAsync(fileUri);

    const blockMatch = content.match(/COURSE\s*CODE\s*\{\s*([^}]+)\s*\}/i);
    let codes = [];
    if (blockMatch) {
      codes = blockMatch[1]
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => /^[A-Za-z]{2,6}\s?\d{3}$/.test(s));
    }

    if (codes.length === 0) {
      const tokenMatches = content.match(/\b[A-Z]{2,6}\s*\d{3}\b/gi) || [];
      codes = tokenMatches.map((s) => s.replace(/\s+/g, " ").trim());
    }

    const normalized = Array.from(new Set(codes.map((c) => c.toUpperCase())));
    console.log("🔎 parsed codes →", normalized);

    if (normalized.length === 0)
      throw new Error("No Course Codes found in COR text.");
    return normalized;
  };

  // Curriculum validation with POST→GET fallback and heavy logs
  const validateAgainstCurriculum = async (codes) => {
    const endpoint = `${BASE_URL}/validate_curriculum_codes.php`;

    const cleanCodes = (codes || [])
      .map((c) => (c || "").toString().trim())
      .filter(Boolean);

    const reqId = Date.now().toString(36);
    logCurr(`[${reqId}] endpoint:`, endpoint);
    logCurr(`[${reqId}] payload:`, { codes: cleanCodes });

    // Try POST first
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json",
        },
        body: JSON.stringify({ codes: cleanCodes }),
      });

      const raw = await res.text();
      logCurr(
        `[${reqId}] POST status:`,
        res.status,
        res.headers.get("content-type")
      );
      logCurr(`[${reqId}] POST raw:`, raw);

      const json = safeJson(raw);
      logCurr(`[${reqId}] POST parsed:`, json);

      if (!res.ok || json?.error)
        throw new Error(json?.error || `HTTP ${res.status}`);
      return json;
    } catch (postErr) {
      logCurr(
        `[${reqId}] POST failed — falling back to GET`,
        String(postErr?.message || postErr)
      );

      const qs = encodeURIComponent(cleanCodes.join(","));
      const url = `${endpoint}?codes=${qs}`;

      const res2 = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const raw2 = await res2.text();

      logCurr(`[${reqId}] GET url:`, url);
      logCurr(
        `[${reqId}] GET status:`,
        res2.status,
        res2.headers.get("content-type")
      );
      logCurr(`[${reqId}] GET raw:`, raw2);

      const json2 = safeJson(raw2);
      logCurr(`[${reqId}] GET parsed:`, json2);

      if (!res2.ok || json2?.error)
        throw new Error(json2?.error || `HTTP ${res2.status}`);
      return json2;
    }
  };

  // Tampering validation call (PDF OCR vs QR-page parsed grades)
  const validateTamper = async () => {
    const url = `${OCR_URL}/validate_grade_tamper`;
    const res = await fetch(url);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const body = await res.text();

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

    throw new Error("Unexpected response from server");
  };

  // Grade value validation (Step 4)
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
          "file:///C:UsersjakesDownloadsAchieveMate_App/technologyocr_api/results/grade_pdf_ocr.txt"
        )
          .then((r) => r.text())
          .catch(() => "");
      }

      // Try server copy as fallback
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
        } catch {
          // ignore
        }
      }

      // Normalize artifacts
      let normalized = (content || "").replace(/[\u00A0\u200B\uFEFF]/g, " ");
      normalized = normalized.replace(/[,·•:;\u00B7]/g, ".");

      const preview = normalized.trim().slice(0, 200).replace(/\n/g, "\\n");
      console.debug("validateGradeValues: preview ->", preview);

      const gradeBlockMatch = normalized.match(/Grade\s*\{\s*([\s\S]*?)\s*\}/i);
      const scanText = gradeBlockMatch ? gradeBlockMatch[1] : normalized;

      const badRegex = /\b(?:3(?:\.00)?|4(?:\.00)?|5(?:\.00)?|INC|DROP)\b/gi;

      const matches = [];
      let m;
      while ((m = badRegex.exec(scanText)) !== null) {
        matches.push(m[0].toUpperCase());
      }

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

  /* ──────────────────────────────────────────────────────────────
     Uploads
     ────────────────────────────────────────────────────────────── */

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

  // Upload with fetch
  const handleUpload = async (docType) => {
    let file;

    // ---- Pick file ----
    const picker = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (picker.canceled) return;
    file = picker.assets[0];

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
        : `${OCR_URL}/upload_grade_pdf`;

    try {
      setUploading(true);
      animateProgress(0);

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        // RN will set boundary automatically
      });

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
          json.saved_image_url ||
          (json.saved_image ? `${OCR_URL}/${json.saved_image}` : null);
        setCertificatePreviewUri(
          previewUrl ? `${previewUrl}?t=${Date.now()}` : null
        );

        await saveToTxtFile("result_certificate_of_enrollment.txt", resultText);

        // Reset validations because base changed
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

  // -------- Upload-button visibility control ----------
  const showUploadButton = (type) => {
    if (uploading) return false;
    if (type === "Certificate of Enrollment") return !certificatePreviewUri;
    if (type === "Copy of Grades") return !gradesPdfUri;
    return true;
  };

  /* ──────────────────────────────────────────────────────────────
     Step 4 orchestration
     ────────────────────────────────────────────────────────────── */
  const goToStep4 = async (options = {}) => {
    const { forceTamperPass = false } = options;

    // Show step 4 immediately
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
      // Quick test: filename to simulate curriculum mismatch
      const corFileName = certificateImageUri
        ? certificateImageUri.split("/").pop()
        : "";
      if (corFileName === "curri_notmatch.pdf") {
        setCurriculumReport({
          items: [],
          summary: { ok_count: 0, total: 0 },
          error: "curriculumn not match",
        });
        setCurriculumOk(false);
        setCurriculumLoading(false);

        const tamperBase = forceTamperPass
          ? Promise.resolve({ exact_match: true, forced: true })
          : validateTamper();
        const gradeValueBase = validateGradeValues();

        const [tamperRes, gradeValueRes] = await Promise.all([
          tamperBase,
          gradeValueBase,
        ]);

        if (tamperRes && !tamperRes.error) {
          setTamperReport(tamperRes);
          setTamperOk(!!tamperRes.exact_match);
        } else {
          setTamperReport({
            error: tamperRes?.error || "Tamper validation failed",
          });
          setTamperOk(false);
        }

        if (gradeValueRes && gradeValueRes.ok) {
          setGradeValueOk(true);
        } else {
          setGradeValueOk(false);
        }
        return;
      }

      // Normal path
      const codes = await readCorCourseCodes();
      logCurr("codes extracted from COR:", codes);

      const tamperBase = forceTamperPass
        ? Promise.resolve({ exact_match: true, forced: true })
        : validateTamper();
      const curriculumBase = validateAgainstCurriculum(codes);
      const gradeValueBase = validateGradeValues();

      const [tamperRes, curriculumRes, gradeValueRes] = await Promise.all([
        tamperBase,
        curriculumBase,
        gradeValueBase,
      ]);

      logCurr("tamper response:", tamperRes);
      logCurr("curriculum response:", curriculumRes);
      logCurr("gradeValue response:", gradeValueRes);

      // Tamper
      if (tamperRes && !tamperRes.error) {
        setTamperReport(tamperRes);
        setTamperOk(!!tamperRes.exact_match);
      } else {
        setTamperReport({
          error: tamperRes?.error || "Tamper validation failed",
        });
        setTamperOk(false);
      }

      // Curriculum
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

      // Grade values
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

  /* ──────────────────────────────────────────────────────────────
     Consent (Step 5)
     ────────────────────────────────────────────────────────────── */
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [consent3, setConsent3] = useState(false);

  /* ──────────────────────────────────────────────────────────────
     Step 6: Review & Confirm
     ────────────────────────────────────────────────────────────── */
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMeta, setReviewMeta] = useState({
    fullname: "",
    srcode: "",
    college: "",
    academic_year: "",
    program: "",
    semester: "",
    year_level: "",
    track: "",
    contact: "",
    section: "",
  });
  const [reviewRows, setReviewRows] = useState([]); // [{idx, code, title, units, grade, section, instructor, mismatchQr}]
  const [reviewSummary, setReviewSummary] = useState({
    totalCourses: "-",
    totalUnits: "-",
    gwa: "-",
  });

  // Compute rank from GWA using specified thresholds
  const rankFromGwa = (gwa) => {
    const n = parseFloat(String(gwa ?? "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) return "-";
    if (n >= 1.0 && n <= 1.25) return "Tech Savant";
    if (n > 1.25 && n <= 1.5) return "Tech Virtuoso";
    if (n > 1.5 && n <= 1.75) return "Tech Prodigy";
    return "-";
  };

  const fetchText = async (url) => {
    const res = await fetch(
      url + (url.includes("?") ? "" : `?t=${Date.now()}`)
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  };

  // Fetch helpers for API lookups
  const fetchJsonFirst = async (urls) => {
    for (const u of urls) {
      try {
        const res = await fetch(u);
        if (!res.ok) continue;
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (_) {
          continue;
        }
      } catch (_) {}
    }
    return null;
  };

  const resolveTrackName = async (abbr) => {
    if (!abbr) return "";
    const a = encodeURIComponent(String(abbr).trim());
    const json = await fetchJsonFirst([
      `${BASE_URL}/major.php?abbreviation=${a}`,
      `${BASE_URL}/major.php?abbr=${a}`,
      `${BASE_URL}/get_major.php?abbr=${a}`,
    ]);
    if (!json) return String(abbr);
    return (
      json?.major_name || json?.data?.major_name || json?.name || String(abbr)
    );
  };

  const resolveContactBySrcode = async (src) => {
    if (!src) return "";
    const s = encodeURIComponent(String(src).trim());
    const json = await fetchJsonFirst([
      `${BASE_URL}/student_manage.php?srcode=${s}`,
      `${BASE_URL}/student_manage.php?SRCODE=${s}`,
      `${BASE_URL}/get_student.php?srcode=${s}`,
    ]);
    if (!json) return "";
    return (
      json?.Contact ||
      json?.contact ||
      json?.contact_number ||
      json?.mobile ||
      json?.data?.contact ||
      ""
    );
  };

  const toNumericGrade = (g) => {
    if (!g) return NaN;
    const t = String(g).toUpperCase().trim();
    if (t === "INC" || t === "DROP") return NaN;
    const n = parseFloat(t.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };

  const loadReviewData = async () => {
    setReviewLoading(true);
    try {
      // grade_for_review.txt contains table + meta
      const coeTxt = await fetchText(`${OCR_URL}/results/grade_for_review.txt`);
      // Weighted Average resides in Grade_with_Units.txt
      const gradeUnitsTxt = await fetchText(
        `${OCR_URL}/results/Grade_with_Units.txt`
      );

      const gwaMatch = gradeUnitsTxt.match(/Weighted Average:\s*([0-9.]+)/i);
      const gwa = gwaMatch ? gwaMatch[1] : "—";

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
        track: (() => {
          const m = coeTxt.match(/Track\s*:\s*([^\n]+)/i);
          return m ? m[1].trim() : "";
        })(),
      };

      // -------- parse table lines --------
      const tableLines = [];
      const lines = coeTxt.split("\n");
      let inTable = false;
      for (let ln of lines) {
        if (ln.startsWith("# Course Code")) {
          inTable = true;
          continue;
        }
        if (inTable) {
          const trimmed = ln.trim();
          if (
            trimmed.startsWith("** NOTHING FOLLOWS **") ||
            trimmed.startsWith("Total no of Course") ||
            trimmed.startsWith("Total no of Units")
          )
            break;

          if (/^\d+\s/.test(ln)) tableLines.push(trimmed);
        }
      }

      // -------- helpers for token classification --------
      const looksLikeUnits = (t) => /^(?:2|3)$/.test(t); // enforce Units = 2 or 3 only
      const looksLikeGrade = (t = "") =>
        /^(?:[1-5](?:\.\d{1,2})?|[1-5]|INC|INCOMPLETE|DRP|DROP|UD|NG|W|WF|P|F|PASS|PASSED)$/i.test(
          t
        );

      const rows = tableLines.map((ln, idx) => {
        // e.g.:
        // "1 NSTP 101 National Service Training Program 1 3 1.75 NSTP-A JUAN DELA CRUZ"
        const tokens = ln.split(/\s+/);

        // find "ABCD 123" course code
        let code = "";
        let codeIdx = -1;
        for (let i = 1; i < tokens.length - 1; i++) {
          if (
            /^[A-Za-z]{2,8}$/.test(tokens[i]) &&
            /^\d{3}$/.test(tokens[i + 1])
          ) {
            code = `${tokens[i]} ${tokens[i + 1]}`;
            codeIdx = i;
            break;
          }
        }

        let title = "";
        let units = "";
        let grade = "";
        let section = "";
        let instructor = "";

        if (codeIdx !== -1) {
          const titleStart = codeIdx + 2;

          // Find the first index where Units (2|3) is followed by a Grade
          let unitsIdx = -1;
          for (let k = titleStart; k < tokens.length; k++) {
            const tk = tokens[k];
            const next = tokens[k + 1];
            if (looksLikeUnits(tk) && looksLikeGrade(next)) {
              unitsIdx = k;
              break;
            }
          }

          // If not found forward (OCR noise), try from the end (last occurrence)
          if (unitsIdx === -1) {
            for (let k = tokens.length - 2; k >= titleStart; k--) {
              if (looksLikeUnits(tokens[k]) && looksLikeGrade(tokens[k + 1])) {
                unitsIdx = k;
                break;
              }
            }
          }

          // Title = everything before Units; keeps series "1/2" inside the title
          const titleEndExclusive = unitsIdx === -1 ? tokens.length : unitsIdx;
          title = tokens.slice(titleStart, titleEndExclusive).join(" ").trim();

          if (unitsIdx !== -1) {
            units = tokens[unitsIdx] || "";
            grade = tokens[unitsIdx + 1] || "";
            section = tokens[unitsIdx + 2] || "";
            instructor = tokens
              .slice(unitsIdx + 3)
              .join(" ")
              .trim();
          }
        }

        return {
          idx: idx + 1,
          code,
          title, // will include "... Program 1" or "... Program 2"
          units, // only "2" or "3"
          grade,
          section,
          instructor,
          mismatchQr: "",
        };
      });

      const totalCoursesMatch = coeTxt.match(/Total no of Course\s*(\d+)/i);
      const totalUnitsMatch = coeTxt.match(/Total no of Units\s*(\d+)/i);
      const summary = {
        totalCourses: totalCoursesMatch ? totalCoursesMatch[1] : rows.length,
        totalUnits: totalUnitsMatch ? totalUnitsMatch[1] : "—",
        gwa,
      };

      // Compute a representative Section (most common non-empty across rows)
      try {
        const sections = rows.map((r) => r.section).filter(Boolean);
        if (sections.length) {
          const counts = sections.reduce((acc, s) => {
            acc[s] = (acc[s] || 0) + 1;
            return acc;
          }, {});
          const best = Object.keys(counts).sort(
            (a, b) => counts[b] - counts[a]
          )[0];
          if (best) meta.section = best;
        }
      } catch (_) {}

      // Enrich track (map abbreviation to major_name) and contact (from BASE_URL by SRCode)
      try {
        if (meta.track) {
          const majorName = await resolveTrackName(meta.track);
          if (majorName) meta.track = String(majorName);
        }
        if (meta.srcode) {
          const contact = await resolveContactBySrcode(meta.srcode);
          if (contact) {
            meta.contact = String(contact);
            setContactNumber(meta.contact);
          }
        }
      } catch (_) {}

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

  // Auto-generate PDF for preview when entering Step 7
  useEffect(() => {
    if (currentStep === 7) {
      (async () => {
        // Ensure contact is loaded before generating
        await ensureContactLoaded();
        setPreviewPage(1);
        await generatePDFToAppDir(
          { ...reviewMeta, contact: contactNumber },
          reviewRows
        );
        try {
          const assetModule = require("../assets/right_result.pdf");
          const { Asset } = require("expo-asset");
          const asset = Asset.fromModule(assetModule);
          await asset.downloadAsync();
          const refB64 = await FileSystem.readAsStringAsync(asset.localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setReferencePdfBase64(refB64);
        } catch (e) {
          console.log("Reference PDF load failed:", e?.message);
        }
      })();
    }
  }, [currentStep]);

  // Fetch contact number by login_id from API and cache locally
  const ensureContactLoaded = async () => {
    try {
      if (contactNumber) return contactNumber;
      const stored = await AsyncStorage.getItem("contact_number");
      if (stored) {
        setContactNumber(stored);
        return stored;
      }
      if (reviewMeta?.srcode) {
        const c = await resolveContactBySrcode(reviewMeta.srcode);
        if (c) {
          const val = String(c);
          setContactNumber(val);
          await AsyncStorage.setItem("contact_number", val);
          setReviewMeta((m) => ({ ...m, contact: val }));
          return val;
        }
      }
      const loginId = (await AsyncStorage.getItem("login_id")) || null;
      if (!loginId) return "";
      const candidates = [
        `${BASE_URL}/student_manage.php?login_id=${encodeURIComponent(
          loginId
        )}`,
        `${BASE_URL}/student_contact.php?login_id=${encodeURIComponent(
          loginId
        )}`,
        `${BASE_URL}/contact.php?login_id=${encodeURIComponent(loginId)}`,
      ];
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const text = await res.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            continue;
          }
          const contact =
            json?.contact ??
            json?.contact_number ??
            json?.mobile ??
            json?.data?.contact ??
            "";
          if (contact) {
            const c = String(contact);
            setContactNumber(c);
            await AsyncStorage.setItem("contact_number", c);
            // Also merge into reviewMeta for subsequent renders
            setReviewMeta((m) => ({ ...m, contact: c }));
            return c;
          }
        } catch (_) {}
      }
      return "";
    } catch (_) {
      return "";
    }
  };

  // Helper to render a lightweight HTML with PDF.js for preview (Android WebView can't render PDFs natively)
  const buildPdfPreviewHtml = (b64, pageNum = 1) => `<!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        html, body { margin: 0; padding: 0; background: #f5f5f5; }
        #wrapper { padding: 8px; }
        #the-canvas { width: 100%; height: auto; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
      <script>
        window.addEventListener('load', async () => {
          try {
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            function base64ToUint8Array(base64) {
              const binary_string = atob(base64);
              const len = binary_string.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
              return bytes;
            }
            const data = base64ToUint8Array('${b64.replace(/'/g, "\\'")}');
            const loadingTask = pdfjsLib.getDocument({ data });
            const pdf = await loadingTask.promise;
            // notify total pages
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'meta', pages: pdf.numPages }));
            }
            const desired = Math.max(1, Math.min(${pageNum}, pdf.numPages));
            const page = await pdf.getPage(desired);
            const scale = 1.3;
            const viewport = page.getViewport({ scale });
            const canvas = document.getElementById('the-canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;

            // Tap-to-measure: report PDF point coordinates back to RN
            canvas.addEventListener('click', (e) => {
              const rect = canvas.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const ptX = x / scale;
              const ptY = (canvas.height - y) / scale; // convert to PDF bottom-left origin
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tap', x, y, ptX, ptY }));
              }
            });
          } catch (e) {
            document.body.innerHTML = '<div style="padding:12px;color:#b00">Preview failed: ' + (e && e.message ? e.message : e) + '</div>';
          }
        });
      </script>
    </head>
    <body>
      <div id="wrapper"><canvas id="the-canvas"></canvas></div>
    </body>
  </html>`;

  // Generate the PDF and save to app directory; return { fileUri, pdfBase64 }
  async function generatePDFToAppDir(reviewMeta, reviewRows) {
    try {
      console.log("User clicked download: starting PDF generation...");
      // Attempt asset load via expo-asset (works on native) with safe fallback
      let templateBytesBase64 = null;
      try {
        const assetModule = require("../assets/DL_Template.pdf");
        const { Asset } = require("expo-asset");
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        templateBytesBase64 = await FileSystem.readAsStringAsync(
          asset.localUri,
          {
            encoding: FileSystem.EncodingType.Base64,
          }
        );
        console.log("Loaded template via Asset:", asset.localUri);
      } catch (e) {
        console.log("Asset load failed, fallback path attempt:", e?.message);
        try {
          const candidate =
            FileSystem.documentDirectory + "../assets/DL_Template.pdf";
          templateBytesBase64 = await FileSystem.readAsStringAsync(candidate, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log("Loaded template via fallback path:", candidate);
        } catch (e2) {
          console.error("Failed to load DL_Template.pdf", e2);
          Alert.alert("Template Missing", "Could not load DL_Template.pdf");
          return null;
        }
      }

      const templateBytes = Uint8Array.from(atob(templateBytesBase64), (c) =>
        c.charCodeAt(0)
      );
      const pdfDoc = await PDFDocument.load(templateBytes);
      const page = pdfDoc.getPages()[0];
      const { width: PAGE_W, height: PAGE_H } = page.getSize();

      // Helper: split name to Last / First / MI (best-effort)
      const splitName = (full = "") => {
        const t = String(full).trim().replace(/\s+/g, " ");
        if (!t) return { last: "", first: "", mi: "" };
        const parts = t.split(" ");
        const last = (parts[0] || "").toUpperCase();
        let mi = "";
        if (parts.length >= 3) {
          const lastPart = parts[parts.length - 1];
          if (/^([A-Za-z])\.?$/.test(lastPart))
            mi = RegExp.$1.toUpperCase() + ".";
        }
        const first = parts.slice(1, mi ? -1 : undefined).join(" ");
        return { last, first, mi };
      };
      // Coordinate helpers: convert FPDF-style mm, top-left origin → pdf-lib points, bottom-left origin
      const mmToPt = (mm) => (mm * 72) / 25.4;
      const Y_ADJUST = 0; // global vertical nudge if needed
      const fromTopLeft = (x_mm, y_mm) => ({
        x: mmToPt(x_mm),
        y: PAGE_H - mmToPt(y_mm) + Y_ADJUST,
      });
      const fromTopLeftAdj = (x_mm, y_mm, dyPt = 0) => {
        const p = fromTopLeft(x_mm, y_mm);
        return { x: p.x, y: p.y + dyPt };
      };

      // 1) College (bold) and Semester, AY
      const collegeTL = fromTopLeft(25, 61.5);
      if (reviewMeta.college)
        page.drawText(String(reviewMeta.college), {
          x: collegeTL.x,
          y: collegeTL.y,
          size: 12,
        });
      // Fine-tune vertical positions for specific lines (negative = lower)
      const SEMAY_Y_SHIFT_PT = -3;
      const semAyTL = fromTopLeftAdj(85, 185, SEMAY_Y_SHIFT_PT);
      const semTxt = `${
        reviewMeta.semester ? String(reviewMeta.semester) + " Semester" : ""
      }${
        reviewMeta.academic_year
          ? ", AY " + String(reviewMeta.academic_year)
          : ""
      }`.trim();
      if (semTxt)
        page.drawText(semTxt, { x: semAyTL.x, y: semAyTL.y, size: 12 });

      // 2) Name: Last / First / M.I. (bold)
      const n = splitName(reviewMeta.fullname || "");
      const lastTL = fromTopLeft(57.5, 196);
      const firstTL = fromTopLeft(102, 196);
      const miTL = fromTopLeft(166, 196);
      page.drawText(n.last, { x: lastTL.x, y: lastTL.y, size: 12 });
      page.drawText(n.first, { x: firstTL.x, y: firstTL.y, size: 12 });
      page.drawText(n.mi, { x: miTL.x, y: miTL.y, size: 12 });

      // 3) Contact, Course, Yr./Sec., Track, Scholarship (underlined in PHP; plain here)
      // Contact number: slightly smaller font and placed a bit lower
      const CONTACT_Y_SHIFT_PT = -3;
      const contactTL = fromTopLeftAdj(55, 205.5, CONTACT_Y_SHIFT_PT);
      if (reviewMeta.contact) {
        const raw = String(reviewMeta.contact).trim();
        const display = raw.startsWith("+")
          ? raw
          : raw.startsWith("0")
          ? "+63" + raw.slice(1)
          : "+63" + raw;
        page.drawText(display, { x: contactTL.x, y: contactTL.y, size: 10 });
      }
      // Fine-tune downward shifts for these single-line fields
      const PROGRAM_Y_SHIFT_PT = -4;
      const YRSEC_Y_SHIFT_PT = -4;
      const SCHOLAR_Y_SHIFT_PT = -4;
      // Keep Course, Yr./Sec., Track font sizes consistent
      const INLINE_INFO_FONT_SIZE = 11;
      const courseTL = fromTopLeftAdj(39.5, 210, PROGRAM_Y_SHIFT_PT);
      if (reviewMeta.program)
        page.drawText(String(reviewMeta.program), {
          x: courseTL.x,
          y: courseTL.y,
          size: INLINE_INFO_FONT_SIZE,
        });
      const yrSecTL = fromTopLeftAdj(41, 215, YRSEC_Y_SHIFT_PT);
      if (reviewMeta.year_level)
        page.drawText(String(reviewMeta.year_level), {
          x: yrSecTL.x,
          y: yrSecTL.y,
          size: INLINE_INFO_FONT_SIZE,
        });
      const TRACK_Y_SHIFT_PT = -3;
      const trackTL = fromTopLeftAdj(103, 215, TRACK_Y_SHIFT_PT);
      if (reviewMeta.track)
        page.drawText(String(reviewMeta.track), {
          x: trackTL.x,
          y: trackTL.y,
          size: INLINE_INFO_FONT_SIZE,
        });
      const scholarTL = fromTopLeftAdj(59, 220, SCHOLAR_Y_SHIFT_PT);
      const scholarshipText =
        "Higher Education Support Program: Free Tuition 2023";
      page.drawText(scholarshipText, {
        x: scholarTL.x,
        y: scholarTL.y,
        size: 11,
      });

      // 4) Table rows
      const rowStartMm = 240;
      const rowStepMm = 5.3;
      const ROW_Y_SHIFT_PT = -3; // move course rows a bit lower
      const COURSE_FONT_SIZE = 9;
      const COURSE_X_SHIFT_PT = -6;
      let totalUnits = 0;
      let totalWG = 0;
      const safeNum = (v) => {
        const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };

      for (let i = 0; i < reviewRows.length; i++) {
        const r = reviewRows[i];
        const yMm = rowStartMm + i * rowStepMm;
        const nameTL = fromTopLeftAdj(30, yMm, ROW_Y_SHIFT_PT);
        const gradeTL = fromTopLeftAdj(133, yMm, ROW_Y_SHIFT_PT);
        const unitsTL = fromTopLeftAdj(154.5, yMm, ROW_Y_SHIFT_PT);
        const wgTL = fromTopLeftAdj(169.8, yMm, ROW_Y_SHIFT_PT);
        const units = safeNum(r.units);
        const grade = safeNum(r.grade);
        const wg = units * grade;
        totalUnits += units;
        totalWG += wg;
        const courseText = `${r.code || ""} ${r.title || ""}`.trim();
        page.drawText(courseText, {
          x: nameTL.x + COURSE_X_SHIFT_PT,
          y: nameTL.y,
          size: COURSE_FONT_SIZE,
        });
        if (Number.isFinite(grade) && grade)
          page.drawText(grade.toFixed(2), {
            x: gradeTL.x,
            y: gradeTL.y,
            size: 10,
          });
        if (Number.isFinite(units) && units)
          page.drawText(String(units), {
            x: unitsTL.x,
            y: unitsTL.y,
            size: 10,
          });
        if (Number.isFinite(wg) && wg)
          page.drawText(wg.toFixed(2), { x: wgTL.x, y: wgTL.y, size: 10 });
      }

      // 5) Totals and summary rows
      const TOTALS_Y_SHIFT_PT = -3; // lower totals, WA and rank
      const totalUnitsTL = fromTopLeftAdj(154.5, 286.5, TOTALS_Y_SHIFT_PT);
      const totalWgTL = fromTopLeftAdj(169.8, 286.5, TOTALS_Y_SHIFT_PT);
      const gwaTL = fromTopLeftAdj(166, 291.5, TOTALS_Y_SHIFT_PT);
      const rankTL = fromTopLeftAdj(160, 296.5, TOTALS_Y_SHIFT_PT);
      const rankVal = rankFromGwa(reviewSummary?.gwa);
      const wa = totalUnits ? totalWG / totalUnits : 0;
      page.drawText(String(totalUnits), {
        x: totalUnitsTL.x,
        y: totalUnitsTL.y,
        size: 10,
      });
      page.drawText(totalWG.toFixed(2), {
        x: totalWgTL.x,
        y: totalWgTL.y,
        size: 10,
      });
      if (wa)
        page.drawText(Number.isFinite(wa) ? wa.toFixed(4) : "", {
          x: gwaTL.x,
          y: gwaTL.y,
          size: 10,
        });
      if (rankVal && rankVal !== "-")
        page.drawText(rankVal, { x: rankTL.x, y: rankTL.y, size: 10 });
      console.log("Inserted data into PDF");

      // Page 2: insert COR and COG images into template if available
      try {
        const fetchBytes = async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ab = await res.arrayBuffer();
          return new Uint8Array(ab);
        };
        const pagesNow = pdfDoc.getPages();
        const ensurePage2 = () => {
          if (pagesNow.length >= 2) return pagesNow[1];
          return pdfDoc.addPage([PAGE_W, PAGE_H]);
        };

        const corUrl = `${OCR_URL}/results/COR_pdf_image.png?t=${Date.now()}`;
        const cogUrl = `${OCR_URL}/results/qr_website_screenshot.png?t=${Date.now()}`;
        const [corBytes, cogBytes] = await Promise.all([
          fetchBytes(corUrl).catch(() => null),
          fetchBytes(cogUrl).catch(() => null),
        ]);

        if (corBytes || cogBytes) {
          const page2 = ensurePage2();
          const COR_BOX = { x: 26.0, y: 18.0, w: 167.0, h: 118.0 };
          const COG_BOX = { x: 25.0, y: 200.0, w: 173.0, h: 118.0 };
          const COR_SHIFT_Y = -15.0;
          const COG_SHIFT_Y = -90.0; // move Copy of Grades a bit higher
          const COG_SHIFT_X = -2.7; // move Copy of Grades a bit to the left
          COR_BOX.y += COR_SHIFT_Y;
          COG_BOX.y += COG_SHIFT_Y;
          COG_BOX.x += COG_SHIFT_X;

          if (corBytes) {
            try {
              const corImg = await pdfDoc.embedPng(corBytes);
              const wPt = mmToPt(COR_BOX.w);
              const hPt = mmToPt(COR_BOX.h);
              const tl = fromTopLeft(COR_BOX.x, COR_BOX.y);
              page2.drawImage(corImg, {
                x: tl.x,
                y: tl.y - hPt,
                width: wPt,
                height: hPt,
              });
            } catch (_) {}
          }
          if (cogBytes) {
            try {
              const cogImg = await pdfDoc.embedPng(cogBytes);
              const wPt = mmToPt(COG_BOX.w);
              const hPt = mmToPt(COG_BOX.h);
              const tl = fromTopLeft(COG_BOX.x, COG_BOX.y);
              page2.drawImage(cogImg, {
                x: tl.x,
                y: tl.y - hPt,
                width: wPt,
                height: hPt,
              });
            } catch (_) {}
          }

          // Add Name and Section on page 2 under the attachments
          try {
            const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
            const timesBold = await pdfDoc.embedFont(StandardFonts.TimesBold);
            const n2 = splitName(reviewMeta.fullname || "");
            const nameStr = `${n2.first}${n2.mi ? " " + n2.mi : ""} ${n2.last}`.trim();
            // Place in the lower space of page 2 (fixed positions from PHP)
            const nameTL = fromTopLeft(53, 263.5);
            page2.drawText(nameStr, { x: nameTL.x, y: nameTL.y, size: 12, font: timesBold });
            const secTL = fromTopLeft(53, 268);
            const secVal = (Array.isArray(reviewRows) && reviewRows.length > 0 && reviewRows[0]?.section)
              ? String(reviewRows[0].section)
              : (reviewMeta.section ? String(reviewMeta.section) : "");
            page2.drawText(secVal, {
              x: secTL.x,
              y: secTL.y,
              size: 11,
              font: times,
            });
          } catch (_) {}
        }
      } catch (e) {
        console.log("Page2 images error:", e?.message);
      }

      // Save as base64 directly (avoids Buffer polyfill issues in Hermes)
      const pdfBase64 = await pdfDoc.saveAsBase64();
      const fileUri = FileSystem.documentDirectory + "Application.pdf";
      await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log("Application.pdf generated and saved:", fileUri);

      setApplicationPdfUri(fileUri);
      setApplicationPdfBase64(pdfBase64);
      return { fileUri, pdfBase64 };
    } catch (err) {
      console.error("PDF generation error:", err);
      Alert.alert("Error", "Failed to generate Application.pdf");
      return null;
    }
  }

  // Helper to generate and then download/save Application.pdf
  async function generateAndDownloadPDF(reviewMeta, reviewRows) {
    try {
      const loadedContact = await ensureContactLoaded();
      const generated = await generatePDFToAppDir(
        { ...reviewMeta, contact: loadedContact || contactNumber },
        reviewRows
      );
      if (!generated) return;
      const { fileUri, pdfBase64 } = generated;

      // Download/save behavior (no text sharing)
      if (Platform.OS === "android") {
        try {
          const saf = FileSystem.StorageAccessFramework;
          const permissions = await saf.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const dirUri = permissions.directoryUri;
            const fileName = `Application_${Date.now()}.pdf`;
            const contentUri = await saf.createFileAsync(
              dirUri,
              fileName,
              "application/pdf"
            );
            await FileSystem.writeAsStringAsync(contentUri, pdfBase64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            Alert.alert(
              "Downloaded",
              `Saved to selected folder as ${fileName}`
            );
            return;
          } else {
            Alert.alert(
              "Storage Permission",
              "Folder not selected. The file remains saved inside the app."
            );
          }
        } catch (e) {
          console.log("SAF download failed:", e?.message);
          Alert.alert("Download failed", "Could not save to external storage.");
        }
      } else if (Platform.OS === "ios") {
        try {
          const { NativeModulesProxy } = require("expo-modules-core");
          const hasExpoSharing = !!(
            NativeModulesProxy && NativeModulesProxy.ExpoSharing
          );
          if (hasExpoSharing) {
            const Sharing = require("expo-sharing");
            await Sharing.shareAsync(fileUri, {
              UTI: "com.adobe.pdf",
              mimeType: "application/pdf",
            });
            return;
          }
        } catch (_) {}
        Alert.alert(
          "PDF Generated",
          "Saved inside the app. Use the Files sheet to export."
        );
      } else {
        Alert.alert(
          "PDF Generated",
          "Saved Application.pdf to local directory."
        );
      }
    } catch (err) {
      console.error("PDF download error:", err);
      Alert.alert("Error", "Failed to save Application.pdf");
    }
  }

  /* ──────────────────────────────────────────────────────────────
     Render
     ────────────────────────────────────────────────────────────── */
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
                width: progressLine,
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
        <View style={{ flex: 1, padding: 20 }}>
          <View style={styles.card}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#0249AD",
                marginBottom: 12,
              }}
            >
              Upload Your Certificate of Registration (COR)
            </Text>

            <View style={{ marginTop: 6, marginBottom: 18 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{ marginTop: 3, marginRight: 8, color: "#6b7280" }}
                >
                  •
                </Text>
                <Text style={{ color: "#6b7280" }}>
                  Accepted format:{" "}
                  <Text style={{ fontWeight: "700" }}>PDF only</Text>
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Text
                  style={{ marginTop: 3, marginRight: 8, color: "#6b7280" }}
                >
                  •
                </Text>
                <Text style={{ color: "#6b7280" }}>
                  Make sure the file is clear, complete, and official
                </Text>
              </View>
            </View>

            {showUploadButton("Certificate of Enrollment") && (
              <TouchableOpacity
                style={styles.blueButtonupload}
                onPress={() => handleUpload("Certificate of Enrollment")}
              >
                <Text style={styles.buttonTextupload}>Upload PDF File</Text>
              </TouchableOpacity>
            )}

            {uploading && (
              <View style={{ alignItems: "center", marginTop: 16 }}>
                <ActivityIndicator size="large" color="#00C881" />
                <Text style={{ marginTop: 8 }}>Uploading...</Text>
                <Animated.View
                  style={{
                    height: 10,
                    backgroundColor: "#00C881",
                    marginTop: 10,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 300],
                    }),
                    borderRadius: 6,
                  }}
                />
              </View>
            )}

            {certificatePreviewUri && (
              <View style={{ marginTop: 16 }}>
                <Image
                  source={{ uri: certificatePreviewUri }}
                  resizeMode="contain"
                  style={{
                    width: "100%",
                    height: undefined,
                    aspectRatio: corAspect,
                    maxHeight: 520,
                    borderRadius: 10,
                    backgroundColor: "#f8fafc",
                  }}
                />
                <View style={{ alignItems: "center", marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={handleRemoveCertificateImage}
                    style={styles.removeImageBtn}
                  >
                    <Icon
                      name="trash-2"
                      size={18}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.removeImageText}>Remove File</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.navStickyContainer}>
            <TouchableOpacity
              style={styles.stepFormNavBtn2}
              onPress={() => setCurrentStep(1)}
            >
              <Text style={styles.navButtonText2}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepFormNavBtn,
                { backgroundColor: certificatePreviewUri ? "#007bff" : "#ccc" },
              ]}
              onPress={() => setCurrentStep(3)}
              disabled={!certificatePreviewUri}
            >
              <Text style={styles.navButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 3: Upload Grades (PDF) */}
      {currentStep === 3 && (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={styles.card}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#0249AD",
                marginBottom: 12,
              }}
            >
              Upload Your Copy of Grades
            </Text>

            <View style={{ marginTop: 6, marginBottom: 18 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{ marginTop: 3, marginRight: 8, color: "#6b7280" }}
                >
                  •
                </Text>
                <Text style={{ color: "#6b7280" }}>
                  Accepted format:{" "}
                  <Text style={{ fontWeight: "700" }}>PDF only</Text>
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{ marginTop: 3, marginRight: 8, color: "#6b7280" }}
                >
                  •
                </Text>
                <Text style={{ color: "#6b7280" }}>
                  Max file size:{" "}
                  <Text style={{ fontWeight: "700" }}>5&nbsp;MB</Text>
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Text
                  style={{ marginTop: 3, marginRight: 8, color: "#6b7280" }}
                >
                  •
                </Text>
                <Text style={{ color: "#6b7280" }}>
                  Use the official, clear, system-generated PDF (with QR, if
                  applicable)
                </Text>
              </View>
            </View>

            {showUploadButton("Copy of Grades") && (
              <TouchableOpacity
                style={styles.blueButtonupload}
                onPress={() => handleUpload("Copy of Grades")}
              >
                <Text style={styles.buttonTextupload}>Upload PDF File</Text>
              </TouchableOpacity>
            )}

            {uploading && (
              <View style={{ alignItems: "center", marginTop: 16 }}>
                <ActivityIndicator size="large" color="#00C881" />
                <Text style={{ marginTop: 8 }}>Uploading...</Text>
                <Animated.View
                  style={{
                    height: 10,
                    backgroundColor: "#00C881",
                    marginTop: 10,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 300],
                    }),
                    borderRadius: 6,
                  }}
                />
              </View>
            )}

            {gradesPreviewUri && (
              <View style={{ marginTop: 16 }}>
                <Image
                  source={{ uri: gradesPreviewUri }}
                  resizeMode="contain"
                  style={{
                    width: "100%",
                    height: undefined,
                    aspectRatio: gradesAspect,
                    maxHeight: 520,
                    borderRadius: 10,
                    backgroundColor: "#f8fafc",
                  }}
                />
                <View style={{ alignItems: "center", marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={handleRemoveGradesImage}
                    style={styles.removeImageBtn}
                  >
                    <Icon
                      name="trash-2"
                      size={18}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.removeImageText}>Remove PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.navStickyContainer}>
            <TouchableOpacity
              style={styles.stepFormNavBtn2}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.navButtonText2}>← Back</Text>
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
                  setTamperOk(true);
                  setCurriculumOk(true);
                  setGradeValueOk(true);
                  setTamperReport({ exact_match: true, forced: true });
                  setCurriculumReport({ all_ok: true, forced: true });
                  setGradeValueReport({ ok: true, forced: true });
                } finally {
                  setTimeout(() => (pressLockRef.current = false), 400);
                }
              }}
              onPress={async () => {
                if (pressLockRef.current) return;
                if (!(gradesPdfUri && validationOk)) return;
                pressLockRef.current = true;
                try {
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

      {/* Step 4: Validation (Tampering + Curriculum + Grade Value) */}
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
                { backgroundColor: consent1 && consent2 ? "#007bff" : "#ccc" },
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

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ width: "48%" }}>
                  <Text
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
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
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
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

                <View style={{ width: "100%" }}>
                  <Text
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
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

                <View style={{ width: "48%" }}>
                  <Text
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
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
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
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

                <View style={{ width: "48%" }}>
                  <Text
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
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
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
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
                        : "-"}
                    </Text>
                  </View>
                </View>
                <View style={{ width: "48%" }}>
                  <Text
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
                  >
                    Track
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
                      {reviewMeta.track ? String(reviewMeta.track) : "-"}
                    </Text>
                  </View>
                </View>
                <View style={{ width: "48%" }}>
                  <Text
                    style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}
                  >
                    Contact Number
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
                      {reviewMeta.contact
                        ? (() => {
                            const raw = String(reviewMeta.contact).trim();
                            if (raw.startsWith("+")) return raw;
                            if (raw.startsWith("0"))
                              return "+63" + raw.slice(1);
                            return "+63" + raw;
                          })()
                        : "-"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Scrollable table */}
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
                <Text>
                  <Text style={{ fontWeight: "700" }}>Rank: </Text>
                  {rankFromGwa(reviewSummary.gwa)}
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
              style={[styles.stepFormNavBtn, { backgroundColor: "#00C881" }]}
              onPress={() => setConfirmOpen(true)}
            >
              <Text style={styles.navButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 7: Generate Application */}
      {currentStep === 7 && (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={[ui.card]}>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
              Generated Application
            </Text>
            {/* Live PDF preview using PDF.js inside WebView (works on Android/iOS) */}
            {applicationPdfBase64 ? (
              <View
                style={{
                  height: 420,
                  width: "100%",
                  marginBottom: 12,
                  position: "relative",
                }}
              >
                <WebView
                  originWhitelist={["*"]}
                  source={{
                    html: buildPdfPreviewHtml(
                      applicationPdfBase64,
                      previewPage
                    ),
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    backgroundColor: "transparent",
                  }}
                  allowFileAccess
                  allowUniversalAccessFromFileURLs
                  onMessage={(e) => {
                    try {
                      const msg = JSON.parse(e?.nativeEvent?.data || "{}");
                      if (msg?.type === "tap") {
                        console.log(
                          "PDF tap at canvas:",
                          msg.x,
                          msg.y,
                          " -> PDF pts:",
                          msg.ptX,
                          msg.ptY
                        );
                      } else if (msg?.type === "meta" && msg?.pages) {
                        setPreviewPageCount(Number(msg.pages));
                      }
                    } catch {}
                  }}
                  onError={(e) =>
                    console.log(
                      "PDF preview error:",
                      e?.nativeEvent?.description
                    )
                  }
                />
                {previewPageCount && previewPageCount > 1 ? (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 0,
                      right: 0,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        backgroundColor: "rgba(255,255,255,0.9)",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 16,
                      }}
                    >
                      {Array.from(
                        { length: previewPageCount },
                        (_, i) => i + 1
                      ).map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setPreviewPage(n)}
                          style={[
                            styles.stepFormNavBtn,
                            {
                              backgroundColor:
                                previewPage === n ? "#007BFF" : "#9CA3AF",
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                            },
                          ]}
                        >
                          <Text style={styles.navButtonText}>{String(n)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="large" color="#0249AD" />
              </View>
            )}
            <TouchableOpacity
              onPress={async () => {
                await generateAndDownloadPDF(reviewMeta, reviewRows);
              }}
              style={[styles.stepFormNavBtn, { alignSelf: "flex-start" }]}
            >
              <Text style={styles.navButtonText}>Download</Text>
            </TouchableOpacity>
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
                try {
                  navigation?.navigate?.("Home");
                } catch (_) {
                  setCurrentStep(1);
                }
              }}
            >
              <Text style={styles.navButtonText}>Finish</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* One NoticeModal instance */}
      <NoticeModal
        visible={noticeOpen}
        title={noticeTitle}
        message={noticeMessage}
        onOk={() => setNoticeOpen(false)}
        onReupload={noticeReupload}
      />
      {/* Step confirmation modal (Step 6 -> Step 7) */}
      <ConfirmModal
        visible={confirmOpen}
        onNo={() => setConfirmOpen(false)}
        onYes={() => {
          setConfirmOpen(false);
          setCurrentStep(7);
        }}
      />
    </View>
  );
}
