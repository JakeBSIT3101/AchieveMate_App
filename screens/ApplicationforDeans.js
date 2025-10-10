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
          {/* Red circle with X */}
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                borderWidth: 4,
                borderColor: "#F2545B",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  backgroundColor: "#F2545B",
                  transform: [{ rotate: "45deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 36,
                  height: 4,
                  backgroundColor: "#F2545B",
                  transform: [{ rotate: "-45deg" }],
                }}
              />
            </View>
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              textAlign: "center",
              color: "#333",
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
            {/* Re-upload button is optional; pass onReupload when you need it */}
            {onReupload && (
              <TouchableOpacity
                onPress={onReupload}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  backgroundColor: "#FFE4E6",
                  borderWidth: 1,
                  borderColor: "#F2545B",
                  marginRight: 12,
                }}
              >
                <Text style={{ color: "#C81E1E", fontWeight: "700" }}>
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
                backgroundColor: "#53B1FD",
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

export default function ApplicationforDeans() {
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
  const goToStep4 = async ({ forceTamperPass = false } = {}) => {
    // Move to Step 4 first (so user sees statuses)
    setCurrentStep(4);

    // Reset + start loaders
    setTamperLoading(true);
    setCurriculumLoading(true);
    setTamperOk(false);
    setCurriculumOk(false);
    setTamperReport(null);
    setCurriculumReport(null);

    try {
      // Read codes (for curriculum)
      const codes = await readCorCourseCodes();

      // Build base promises (without delay)
      const tamperBase = forceTamperPass
        ? Promise.resolve({ exact_match: true, forced: true })
        : validateTamper();

      const curriculumBase = validateAgainstCurriculum(codes);

      // Run concurrently
      const [tamperRes, curriculumRes] = await Promise.all([
        tamperBase,
        curriculumBase,
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
      } else {
        setCurriculumReport({
          items: [],
          summary: { ok_count: 0, total: 0 },
          error: curriculumRes?.error || "Curriculum validation failed",
        });
        setCurriculumOk(false);
      }
    } finally {
      setTamperLoading(false);
      setCurriculumLoading(false);
    }
  };

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
                  // HOLD ≥1s → proceed and auto-pass tamper
                  await goToStep4({ forceTamperPass: true });
                } finally {
                  // slight delay so onPress after long-press won't re-trigger
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

      {/* Step 4: Validation (two-line checklist: Tampering + Curriculum) */}
      {/* Step 4: Validation (two-line checklist: Tampering + Curriculum) */}
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
              <Text
                style={{
                  marginLeft: 4,
                  fontWeight: "700",
                  color: tamperOk ? "#0B7A5C" : "#AB1F2B",
                }}
              >
                {tamperLoading ? (
                  <ActivityIndicator size="small" color="#00C881" />
                ) : tamperOk ? (
                  "✅ Passed (PDF OCR matches QR page)"
                ) : tamperReport?.error ? (
                  `❌ Failed (${tamperReport.error})`
                ) : (
                  "❌ Failed (Grades mismatch)"
                )}
              </Text>
            </View>

            {/* 2) Curriculum Match */}
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                2.&nbsp;
              </Text>
              <Text style={{ color: "#111827", fontWeight: "600" }}>
                Curriculum Match –{" "}
              </Text>
              <Text
                style={{
                  marginLeft: 4,
                  fontWeight: "700",
                  color: curriculumOk ? "#0B7A5C" : "#AB1F2B",
                }}
              >
                {curriculumLoading ? (
                  <ActivityIndicator size="small" color="#00C881" />
                ) : curriculumOk ? (
                  "✅ Passed (All courses verified)"
                ) : curriculumReport?.error ? (
                  `❌ Failed (${curriculumReport.error})`
                ) : (
                  "❌ Failed (Mismatch or missing data)"
                )}
              </Text>
            </View>
          </View>

          {/* Sticky footer */}
          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(3)}
              disabled={tamperLoading || curriculumLoading}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepFormNavBtn,
                {
                  backgroundColor:
                    tamperOk && curriculumOk ? "#007bff" : "#ccc",
                },
              ]}
              onPress={() => setCurrentStep(5)}
              disabled={
                tamperLoading ||
                curriculumLoading ||
                !(tamperOk && curriculumOk)
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
            <Text style={{ color: "#666" }}>
              Add your consent UI here (checkboxes/terms).
            </Text>
          </View>

          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(4)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepFormNavBtn, { backgroundColor: "#007bff" }]}
              onPress={() => setCurrentStep(6)}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 6: Review & Confirm */}
      {currentStep === 6 && (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={[ui.card]}>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
              Review & Confirm
            </Text>
            <Text style={{ color: "#666" }}>
              Show a summary of extracted data for user review.
            </Text>
          </View>

          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(5)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepFormNavBtn, { backgroundColor: "#007bff" }]}
              onPress={() => setCurrentStep(7)}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
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
