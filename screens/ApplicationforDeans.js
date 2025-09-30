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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import styles from "../styles";
import { OCR_URL } from "../config/api";
import Icon from "react-native-vector-icons/Feather";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

export default function ApplicationforDeans() {
  const [currentStep, setCurrentStep] = useState(1);
  const [ocrResult, setOcrResult] = useState("");
  const [gradesImageUri, setGradesImageUri] = useState(null);

  // Original file URI of the chosen COR PDF (we still keep this if you need it)
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
    uploadBtn: {
      alignSelf: "stretch",
      borderRadius: 12,
    },
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

  const steps = [
    "Guideline",
    "Uploading Certificate of Enrollment",
    "Uploading Copy of Grades",
    "Validation",
    "Confirmation",
  ];

  const animateProgress = (progress) => {
    Animated.timing(progressAnim, {
      toValue: progress, // you're passing 0..100; okay given your existing interpolation
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Upload with fetch (unchanged logic)
  const handleUpload = async (docType) => {
    let file;
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
      } else {
        setGradesImageUri(file.uri);
        setGradesResult(resultText);
        await saveToTxtFile("result_copy_of_grade.txt", resultText);
      }

      Alert.alert("Uploaded", `${docType} uploaded successfully.`);
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
  };

  const handleRemoveCertificateImage = () => {
    setCertificateImageUri(null);
    setCertificatePreviewUri(null);
    setOcrResult("");
    setEnrollmentResult("");
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
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          {steps.map((step, index) => (
            <View key={index} style={{ alignItems: "center", flex: 1 }}>
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
                {step.split(" ")[0]}
              </Text>
            </View>
          ))}
        </View>

        {/* Line Indicator */}
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

      {/* Step 1: Guidelines (scrollable) */}
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

      {/* Step 2: Upload Certificate (scrollable) */}
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
                <Text style={styles.uploadButtonText}>
                  Upload Certificate of Enrollment
                </Text>
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

      {/* Step 3: Upload Copy of Grades (scrollable) */}
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
                <Text style={styles.uploadButtonText}>
                  Upload Copy of Grades
                </Text>
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
                { backgroundColor: gradesImageUri ? "#007bff" : "#ccc" },
              ]}
              onPress={() => setCurrentStep(4)}
              disabled={!gradesImageUri}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
