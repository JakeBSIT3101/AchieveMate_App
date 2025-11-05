import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import PdfUploader from "../components/PdfUploader";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Checkbox, Provider as PaperProvider } from "react-native-paper";

// Backend OCR function
const runOCRBackend = async (fileUri) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: "upload.jpg",
      type: "image/jpeg",
    });

    const response = await fetch("http://192.168.18.250:5000/ocr", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) throw new Error("OCR failed");

    const data = await response.json();
    return data.text || "No text detected";
  } catch (err) {
    console.error("runOCRBackend error:", err);
    throw err;
  }
};

export default function ApplicationForGraduation() {
  const [currentStep, setCurrentStep] = useState(1);
  const [coe, setCoe] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [step1Consent, setStep1Consent] = useState(false);
  const [grades, setGrades] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");

  const [form, setForm] = useState({
    surname: "",
    firstName: "",
    middleName: "",
    extensionName: "",
    srCode: "",
    birthDate: "",
    placeOfBirth: "",
    homeAddress: "",
    zipCode: "",
    contactNumber: "",
    emailAddress: "",
    secondarySchool: "",
    secondaryYear: "",
    elementarySchool: "",
    elementaryYear: "",
    gradDecemberChecked: false,
    gradDecemberYear: "",
    gradMayChecked: false,
    gradMayYear: "",
    gradMidtermChecked: false,
    gradMidtermYear: "",
    college: "",
    program: "",
    major: "",
  });

  const steps = [
    "Guidelines",
    "Upload COR",
    "Upload Grades",
    "Application Form",
    "Validation & Info",
    "Review & Submit",
  ];

  const STORAGE_KEY = "@app_grad_form_v1";

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setForm(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed to load saved form:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      } catch (e) {
        console.warn("Failed to save form:", e);
      }
    })();
  }, [form]);

  // Updated file picker to use backend OCR
  const pickFile = async (type) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: type === "coe" ? "image/*" : "application/pdf",
      copyToCacheDirectory: true,
    });

    if (result.type === "cancel") return;

    // Handle modern DocumentPicker format
    const file = result.assets ? result.assets[0] : result;
    if (!file.uri) throw new Error("No file URI returned from picker");

    const fileUri = file.uri;
    const fileName = file.name || "document.pdf";

    const newPath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: fileUri,
        to: newPath,
      });

      if (type === "coe") {
        setCoe(newPath);
        setOcrText("");
        setOcrLoading(true);

        try {
          const text = await runOCRBackend(newPath);
          setOcrText(text);
        } catch (error) {
          Alert.alert("Error", "Failed to extract text from COR.");
          setOcrText("");
        } finally {
          setOcrLoading(false);
        }
      } else if (type === "grades") setGrades(newPath);
      else setAttachments((prev) => [...prev, { id: Date.now(), uri: newPath }]);

      Alert.alert("Success", `${fileName} uploaded successfully!`);
    } catch (error) {
      console.error("File picker error:", error);
      Alert.alert("Error", error.message || "Failed to pick file.");
    }
  };

  const nextStep = () =>
    setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
  const prevStep = () =>
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleGrad = (key) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearFormStorage = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setForm({
        surname: "",
        firstName: "",
        middleName: "",
        extensionName: "",
        srCode: "",
        birthDate: "",
        placeOfBirth: "",
        homeAddress: "",
        zipCode: "",
        contactNumber: "",
        emailAddress: "",
        secondarySchool: "",
        secondaryYear: "",
        elementarySchool: "",
        elementaryYear: "",
        gradDecemberChecked: false,
        gradDecemberYear: "",
        gradMayChecked: false,
        gradMayYear: "",
        gradMidtermChecked: false,
        gradMidtermYear: "",
        college: "",
        program: "",
        major: "",
      });
      setCoe(null);
      setOcrText("");
      setGrades(null);
      setAttachments([]);
      setGuardianName("");
      setGuardianContact("");
      Alert.alert("Cleared", "Saved form cleared from local storage.");
    } catch (e) {
      console.warn("Failed to clear saved form:", e);
    }
  };

  return (
    <PaperProvider>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Application for Graduation</Text>

        {/* Step progress */}
        <View style={styles.progressContainer}>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepContainer}>
              <View
                style={[
                  styles.circle,
                  currentStep === index + 1 && styles.activeCircle,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    currentStep === index + 1 && styles.activeStepNumber,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.stepLabel}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          {/* STEP 1 - Guidelines */}
          {currentStep === 1 && (
            <View>
              <Text style={styles.stepTitle}>Step 1: Guidelines</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Graduation Guidelines</Text>
                <Text style={styles.cardText}>
                  A student’s completion of academic requirements is recognized
                  through the Graduation Application Process, which ensures that
                  only qualified candidates are endorsed for graduation.
                </Text>
                <View style={styles.list}>
                  <Text style={styles.listItem}>
                    • Apply for graduation within the prescribed schedule set by
                    the university;
                  </Text>
                  <Text style={styles.listItem}>
                    • Upload required documents including Final Grades and
                    Certificate of Current Enrollment (COR);
                  </Text>
                  <Text style={styles.listItem}>
                    • Ensure all uploaded grades correspond to the approved
                    curriculum;
                  </Text>
                  <Text style={styles.listItem}>
                    • Address any noted deficiencies before submitting the
                    application;
                  </Text>
                  <Text style={styles.listItem}>
                    • Submit the completed Graduation Application Form for
                    Program Chair review.
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>DATA PRIVACY AGREEMENT</Text>
                <Text style={styles.cardText}>
                  I agree that my details be utilized for evaluating my academic
                  records and other graduation-related purposes.
                </Text>
                <Text style={styles.signature}>
                  Signature over Printed Name of Student
                </Text>

                <View style={styles.checkboxContainer}>
                  <Checkbox
                    status={step1Consent ? "checked" : "unchecked"}
                    onPress={() => setStep1Consent(!step1Consent)}
                    color="#0249AD"
                  />
                  <Text style={styles.text}>
                    I have read and agree to the Data Privacy Agreement.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* STEP 2 - Upload COR */}
          {currentStep === 2 && (
            <View>
              <Text style={styles.stepTitle}>
                Step 2: Upload Certificate of Current Enrollment (COR)
              </Text>
              <PdfUploader
                label="Certificate of Current Enrollment (COR)"
                fileUri={coe}
                onPickFile={() => pickFile("coe")}
                webviewHeight={400}
              />

              {ocrLoading && (
                <View style={{ marginTop: 12, alignItems: "center" }}>
                  <ActivityIndicator size="large" color="#0249AD" />
                  <Text style={{ marginTop: 8, color: "#555" }}>
                    Extracting text...
                  </Text>
                </View>
              )}

              {ocrText && !ocrLoading && (
                <View style={[styles.card, { marginTop: 12 }]}>
                  <Text style={styles.cardTitle}>OCR Extracted Text</Text>
                  <ScrollView style={{ maxHeight: 200 }}>
                    <Text style={styles.cardText}>{ocrText}</Text>
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* STEP 3 - Upload Grades */}
          {currentStep === 3 && (
            <View>
              <Text style={styles.stepTitle}>Step 3: Upload Grades</Text>
              <Text style={styles.text}>
                Upload your final grades for validation. Accepted format: PDF.
              </Text>
              <PdfUploader
                label="Grades"
                fileUri={grades}
                onPickFile={() => pickFile("grades")}
              />
            </View>
          )}

          {/* STEP 4 - Application Form */}
          {currentStep === 4 && (
            <View>
              <Text style={styles.stepTitle}>Step 4: Application Form</Text>
              <Text style={styles.text}>
                Fill out the required fields below accurately.
              </Text>

              {Object.keys(form).map((key) => (
                <View key={key}>
                  <Text style={styles.inputLabel}>{key}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[key]}
                    onChangeText={(value) => updateField(key, value)}
                  />
                </View>
              ))}

              {/* Graduation checkboxes */}
              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={form.gradDecemberChecked ? "checked" : "unchecked"}
                  onPress={() => toggleGrad("gradDecemberChecked")}
                  color="#0249AD"
                />
                <Text style={styles.text}>Graduation in December?</Text>
                {form.gradDecemberChecked && (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Year"
                    value={form.gradDecemberYear}
                    onChangeText={(value) =>
                      updateField("gradDecemberYear", value)
                    }
                  />
                )}
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={form.gradMayChecked ? "checked" : "unchecked"}
                  onPress={() => toggleGrad("gradMayChecked")}
                  color="#0249AD"
                />
                <Text style={styles.text}>Graduation in May?</Text>
                {form.gradMayChecked && (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Year"
                    value={form.gradMayYear}
                    onChangeText={(value) => updateField("gradMayYear", value)}
                  />
                )}
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={form.gradMidtermChecked ? "checked" : "unchecked"}
                  onPress={() => toggleGrad("gradMidtermChecked")}
                  color="#0249AD"
                />
                <Text style={styles.text}>Graduation in Midterm?</Text>
                {form.gradMidtermChecked && (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Year"
                    value={form.gradMidtermYear}
                    onChangeText={(value) =>
                      updateField("gradMidtermYear", value)
                    }
                  />
                )}
              </View>
            </View>
          )}

          {/* STEP 5 - Validation & Info */}
          {currentStep === 5 && (
            <View>
              <Text style={styles.stepTitle}>Step 5: Validation & Info</Text>
              <Text style={styles.text}>
                Please provide your guardian information for validation:
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Guardian Name"
                value={guardianName}
                onChangeText={setGuardianName}
              />
              <TextInput
                style={styles.input}
                placeholder="Guardian Contact Number"
                value={guardianContact}
                onChangeText={setGuardianContact}
              />
            </View>
          )}

          {/* STEP 6 - Review & Submit */}
          {currentStep === 6 && (
            <View>
              <Text style={styles.stepTitle}>Step 6: Review & Submit</Text>
              <Text style={styles.text}>
                Please review all your inputs and attachments before submitting.
              </Text>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={() =>
                  Alert.alert("Submitted", "Your application has been submitted.")
                }
              >
                <Text style={styles.submitText}>Submit Application</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: "#aaa", marginTop: 12 }]}
                onPress={clearFormStorage}
              >
                <Text style={styles.submitText}>Clear Form</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Navigation */}
        <View style={styles.navigation}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.navButton} onPress={prevStep}>
              <Text style={styles.navButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {currentStep < steps.length && (
            <TouchableOpacity
              style={[
                styles.navButtonPrimary,
                currentStep === 1 && !step1Consent && { backgroundColor: "#aaa" },
              ]}
              onPress={nextStep}
              disabled={currentStep === 1 && !step1Consent}
            >
              <Text style={styles.navButtonTextPrimary}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: "#f6f6f6" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  progressContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  stepContainer: { alignItems: "center", width: "15%" },
  circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#ccc", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  activeCircle: { borderColor: "#0249AD", backgroundColor: "#0249AD" },
  stepNumber: { color: "#666", fontWeight: "600" },
  activeStepNumber: { color: "#fff" },
  stepLabel: { fontSize: 10, textAlign: "center" },
  stepTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  text: { color: "#555", lineHeight: 20 },
  sectionHeader: { fontSize: 16, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  inputLabel: { fontWeight: "600", marginTop: 10, marginBottom: 4, textTransform: "capitalize" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fafafa", marginBottom: 10 },
  gradRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  submitButton: { backgroundColor: "#0249AD", paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 12 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  navigation: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  navButton: { backgroundColor: "#eee", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navButtonPrimary: { backgroundColor: "#0249AD", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navButtonText: { color: "#333", fontWeight: "600" },
  navButtonTextPrimary: { color: "#fff", fontWeight: "600" },
  attachmentButton: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginTop: 10, backgroundColor: "#fafafa" },
  attachmentText: { color: "#333", fontWeight: "600" },
  list: { paddingLeft: 12, marginTop: 4 },
  listItem: { marginBottom: 4, color: "#555" },
  cardTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  cardText: { color: "#555", lineHeight: 20 },
  signature: { marginTop: 10, fontStyle: "italic", color: "#333" },
});
