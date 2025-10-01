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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import styles from "../styles";
import { OCR_URL } from "../config/api";
import Icon from "react-native-vector-icons/Feather";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

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
  const [gradesImageUri, setGradesImageUri] = useState(null);

  // Original file URI of the chosen COR PDF
  const [certificateImageUri, setCertificateImageUri] = useState(null);
  // Cropped image served by Flask (results/COR_pdf_image.png as absolute URL)
  const [certificatePreviewUri, setCertificatePreviewUri] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [enrollmentResult, setEnrollmentResult] = useState("");
  const [gradesResult, setGradesResult] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [convertedImage, setConvertedImage] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);

  // Cross-field validation state
  const [validationOk, setValidationOk] = useState(false);
  const [validationDetail, setValidationDetail] = useState(null);

  // Modal state
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("Notice");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeReupload, setNoticeReupload] = useState(null); // function or null

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

  // Aspect ratio for Grades preview (usually landscape)
  const [gradesAspect, setGradesAspect] = useState(1.5);
  useEffect(() => {
    if (!gradesImageUri) return;
    Image.getSize(
      gradesImageUri,
      (w, h) => {
        if (w && h) setGradesAspect(w / h);
      },
      () => {}
    );
  }, [gradesImageUri]);

  /* ---------- 7-step flow ---------- */
  const steps = [
    "Guidelines",
    "Upload COR ",
    "Upload COG",
    "Validation",
    "Consent",
    "Reviewing",
    "Generation",
  ];

  // ===== NEW: spacing between steps =====
  const STEP_GAP = 28; // tweak this value to increase/decrease spacing
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
        handleRemoveGradesImage(); // clears the image to re-upload
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

  // Upload with fetch
  const handleUpload = async (docType) => {
    let file;

    // ---- Pick file/image ----
    if (docType === "Certificate of Enrollment") {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
      });
      if (result.canceled) return;
      file = result.assets[0];
    } else {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Denied",
          "Permission to access media is required!"
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (result.canceled || !result.assets || result.assets.length === 0)
        return;
      file = result.assets[0];
    }

    // ---- Build form data ----
    const formData = new FormData();
    formData.append(docType === "Certificate of Enrollment" ? "pdf" : "image", {
      uri: file.uri,
      name:
        docType === "Certificate of Enrollment" ? "document.pdf" : "image.jpg",
      type:
        docType === "Certificate of Enrollment"
          ? "application/pdf"
          : "image/jpeg",
    });

    const endpoint =
      docType === "Certificate of Enrollment"
        ? `${OCR_URL}/upload_registration_summary_pdf`
        : `${OCR_URL}/upload`;

    try {
      setUploading(true);
      setUploadProgress(0);
      animateProgress(0);

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const json = await res.json();
      setUploading(false);

      if (!res.ok) throw new Error(json.error || "Upload failed");

      const resultText = json.result ?? "No OCR result available.";
      setOcrResult(resultText);

      if (docType === "Certificate of Enrollment") {
        setCertificateImageUri(file.uri);
        setEnrollmentResult(resultText);

        const previewUrl =
          json.saved_image_url || `${OCR_URL}/${json.saved_image}`;
        setCertificatePreviewUri(
          previewUrl ? `${previewUrl}?t=${Date.now()}` : null
        );

        await saveToTxtFile("result_certificate_of_enrollment.txt", resultText);

        setValidationOk(false);
        setValidationDetail(null);

        Alert.alert(
          "Uploaded",
          "Certificate of Enrollment uploaded successfully."
        );
      } else {
        setGradesImageUri(file.uri);
        setGradesResult(resultText);
        await saveToTxtFile("result_copy_of_grade.txt", resultText);

        const ok = await runCrossValidation();

        if (ok) {
          Alert.alert("Uploaded", "Copy of Grades uploaded successfully.");
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
    setGradesImageUri(null);
    setOcrResult("");
    setGradesResult("");
    setValidationOk(false);
    setValidationDetail(null);
  };

  const handleRemoveCertificateImage = () => {
    setCertificateImageUri(null);
    setCertificatePreviewUri(null);
    setOcrResult("");
    setEnrollmentResult("");
    setValidationOk(false);
    setValidationDetail(null);
  };

  // -------- Upload-button visibility control ----------
  const showUploadButton = (type) => {
    if (uploading) return false;
    if (type === "Certificate of Enrollment") return !certificatePreviewUri;
    if (type === "Copy of Grades") return !gradesImageUri;
    return true;
  };
  // ----------------------------------------------------

  return (
    <View style={[styles.container1, { flex: 1 }]}>
      {/* Step Progress (static header) */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start", // was space-between
            marginBottom: 20,
          }}
        >
          {steps.map((step, index) => (
            <View
              key={index}
              style={{
                alignItems: "center",
                // marginRight gap for all but last item:
                marginRight: index !== steps.length - 1 ? STEP_GAP : 0,
              }}
            >
              <View
                style={{
                  backgroundColor: currentStep > index ? "#00C881" : "#E6E6E6",
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
                style={{
                  fontSize: 10,
                  color: currentStep > index ? "#00C881" : "#999",
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        {/* Line Indicator (unchanged) */}
        <View
          style={{
            position: "absolute",
            top: 12,
            left: 30,
            right: 30,
            height: 2,
            backgroundColor: "#E6E6E6",
            zIndex: -1,
          }}
        >
          <View
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
              height: 2,
              backgroundColor: "#00C881",
            }}
          />
        </View>
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

      {/* Step 3: Upload Grades */}
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
                <Text style={styles.uploadButtonText}>Upload Grades</Text>
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

            {gradesImageUri && (
              <View style={[ui.card, { marginTop: 16 }]}>
                <Image
                  source={{ uri: gradesImageUri }}
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
                      Remove Image
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky bottom nav */}
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
                    gradesImageUri && validationOk ? "#007bff" : "#ccc",
                },
              ]}
              onPress={() => setCurrentStep(4)}
              disabled={!(gradesImageUri && validationOk)}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 4: Validation (summary) */}
      {currentStep === 4 && (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={[ui.card]}>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
              Validation
            </Text>
            <Text style={{ color: "#666" }}>
              Files validated {validationOk ? "successfully." : "not yet."}
            </Text>
          </View>

          <View style={[styles.navStickyContainer, stickyFooter]}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(3)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepFormNavBtn, { backgroundColor: "#007bff" }]}
              onPress={() => setCurrentStep(5)}
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
