import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { Checkbox, Provider as PaperProvider } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function ApplicationForLatinHonor() {
  const [currentStep, setCurrentStep] = useState(1);
  const [consentChecked, setConsentChecked] = useState(false);
  const [step1Checked, setStep1Checked] = useState(false);
  const [validationDone, setValidationDone] = useState(false);

  // File states
  const [consentFile, setConsentFile] = useState(null);
  const [gradeFile, setGradeFile] = useState(null);
  const [goodMoralFile, setGoodMoralFile] = useState(null);
  const [ojtFile, setOjtFile] = useState(null);
  const [barangayFile, setBarangayFile] = useState(null);

  const steps = [
    "Guidelines",
    "Consent Form",
    "Grade Requirements",
    "Grades Validation",
    "Required Documents",
    "Review & Submit",
  ];

  const nextStep = () =>
    setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
  const prevStep = () =>
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));

  // File picker for PDFs
  const pickPDF = async (setter) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.type === "success") setter(result);
    } catch (err) {
      console.warn("Error picking file:", err);
    }
  };

  // Image picker for barangay clearance
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!result.canceled) setBarangayFile(result.assets[0]);
    } catch (err) {
      console.warn("Image picker error:", err);
    }
  };

  // Mock grades validation
  const validateGrades = () => {
    if (!gradeFile) {
      Alert.alert("Missing File", "Please upload your grades before validation.");
      return;
    }
    setValidationDone(true);
    Alert.alert("Validated", "Grades successfully validated. No deficiencies found.");
  };

  return (
    <PaperProvider>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Application for Latin Honors</Text>

        {/* Step Progress */}
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
              <Text style={styles.text}>
                The following are the general guidelines for applying for Latin
                Honors at Batangas State University:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  1. Must have completed at least 50% of total units at Batangas
                  State University.
                </Text>
                <Text style={styles.listItem}>
                  2. Must have continuous residence for at least 2 years (4-year
                  course) or 2.5 years (5-year course).
                </Text>
                <Text style={styles.listItem}>
                  3. Shiftees must have taken at least 50% of units in the
                  current program with required continuous residence.
                </Text>
                <Text style={styles.listItem}>
                  4. Must carry a normal load of at least 15 units per semester
                  unless justified.
                </Text>
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={step1Checked ? "checked" : "unchecked"}
                  onPress={() => setStep1Checked(!step1Checked)}
                  color="#0249AD"
                />
                <Text style={styles.text}>
                  I have read and understood the guidelines.
                </Text>
              </View>
            </View>
          )}

          {/* STEP 2 - Consent Form Upload */}
          {currentStep === 2 && (
            <View>
              <Text style={styles.stepTitle}>Step 2: Data Privacy Agreement</Text>
              <Text style={styles.text}>
                Submit a signed Consent Form allowing Batangas State University
                to process your academic information for Latin Honor evaluation.
              </Text>

              <TouchableOpacity
                style={styles.uploadBox}
                onPress={() => pickPDF(setConsentFile)}
              >
                {consentFile ? (
                  <View style={{ alignItems: "center" }}>
                    <Icon name="file-pdf-box" size={50} color="#e74c3c" />
                    <Text style={styles.fileName}>{consentFile.name}</Text>
                    <Text style={styles.successText}>Uploaded successfully</Text>
                  </View>
                ) : (
                  <>
                    <Icon name="upload" size={40} color="#666" />
                    <Text style={styles.uploadText}>
                      Tap to upload your signed Consent Form (PDF)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={consentChecked ? "checked" : "unchecked"}
                  onPress={() => setConsentChecked(!consentChecked)}
                  color="#0249AD"
                />
                <Text style={styles.text}>I agree to the Data Privacy Statement.</Text>
              </View>
            </View>
          )}

          {/* STEP 3 - Grade Requirements */}
          {currentStep === 3 && (
            <View>
              <Text style={styles.stepTitle}>Step 3: Grade Requirements</Text>
              <Text style={styles.text}>
                Candidates must meet the following academic standards:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>• No grade of 4.00 or INC.</Text>
                <Text style={styles.listItem}>• No dropped or failing grades.</Text>
                <Text style={styles.listItem}>• Must have no record of misconduct.</Text>
              </View>

              <Text style={styles.sectionHeader}>Upload Copy of Grades (PDF)</Text>
              <TouchableOpacity
                style={styles.uploadBox}
                onPress={() => pickPDF(setGradeFile)}
              >
                {gradeFile ? (
                  <View style={{ alignItems: "center" }}>
                    <Icon name="file-pdf-box" size={50} color="#e74c3c" />
                    <Text style={styles.fileName}>{gradeFile.name}</Text>
                    <Text style={styles.successText}>Uploaded successfully</Text>
                  </View>
                ) : (
                  <>
                    <Icon name="upload" size={40} color="#666" />
                    <Text style={styles.uploadText}>Tap to upload Grades PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 4 - Grades Validation */}
          {currentStep === 4 && (
            <View>
              <Text style={styles.stepTitle}>Step 4: Grades Validation</Text>
              <Text style={styles.text}>
                This section verifies the uploaded grades. The system checks for
                inconsistencies, missing units, or invalid grades.
              </Text>

              <View style={styles.cardInner}>
                <Text style={styles.cardTitle}>Validation Summary</Text>
                <Text style={styles.text}>
                  Uploaded File:{" "}
                  {gradeFile ? (
                    <Text style={styles.bold}>{gradeFile.name}</Text>
                  ) : (
                    <Text style={{ color: "#999" }}>No file uploaded yet</Text>
                  )}
                </Text>
                <Text style={styles.text}>
                  Status:{" "}
                  {validationDone ? (
                    <Text style={{ color: "#00C881", fontWeight: "600" }}>
                      Validated – No deficiencies found.
                    </Text>
                  ) : (
                    <Text style={{ color: "#f39c12" }}>Pending validation</Text>
                  )}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.validateButton,
                  validationDone && { backgroundColor: "#00C881" },
                ]}
                onPress={validateGrades}
              >
                <Text style={styles.validateText}>
                  {validationDone ? "Grades Validated" : "Validate Grades"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 5 - Required Documents */}
          {currentStep === 5 && (
            <View>
              <Text style={styles.stepTitle}>Step 5: Required Documents</Text>
              <Text style={styles.text}>
                Upload the following required documents for verification:
              </Text>

              <Text style={styles.sectionHeader}>
                Certificate of Good Moral Character (PDF)
              </Text>
              <TouchableOpacity
                style={styles.uploadBoxSmall}
                onPress={() => pickPDF(setGoodMoralFile)}
              >
                {goodMoralFile ? (
                  <Text style={styles.fileName}>{goodMoralFile.name}</Text>
                ) : (
                  <>
                    <Icon name="upload" size={30} color="#666" />
                    <Text style={styles.uploadText}>Upload PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.sectionHeader}>
                Certificate of OJT Completion (PDF)
              </Text>
              <TouchableOpacity
                style={styles.uploadBoxSmall}
                onPress={() => pickPDF(setOjtFile)}
              >
                {ojtFile ? (
                  <Text style={styles.fileName}>{ojtFile.name}</Text>
                ) : (
                  <>
                    <Icon name="upload" size={30} color="#666" />
                    <Text style={styles.uploadText}>Upload PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.sectionHeader}>
                Barangay Clearance (Image)
              </Text>
              <TouchableOpacity style={styles.uploadBoxSmall} onPress={pickImage}>
                {barangayFile ? (
                  <Image
                    source={{ uri: barangayFile.uri }}
                    style={styles.previewSmall}
                  />
                ) : (
                  <>
                    <Icon name="image" size={30} color="#666" />
                    <Text style={styles.uploadText}>Upload JPEG / PNG</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 6 - Review & Submit */}
          {currentStep === 6 && (
            <View>
              <Text style={styles.stepTitle}>Step 6: Review & Submit</Text>
              <Text style={styles.text}>
                Review all your uploaded files and validated results before final submission.
              </Text>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !consentChecked && { backgroundColor: "#aaa" },
                ]}
                disabled={!consentChecked}
                onPress={() =>
                  Alert.alert(
                    "Submitted",
                    "Your Latin Honor application has been submitted (mock)."
                  )
                }
              >
                <Text style={styles.submitText}>Submit Application</Text>
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
                currentStep === 1 && !step1Checked && { backgroundColor: "#aaa" },
              ]}
              onPress={nextStep}
              disabled={currentStep === 1 && !step1Checked}
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
  progressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  stepContainer: { alignItems: "center", width: "15%" },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  activeCircle: { borderColor: "#0249AD", backgroundColor: "#0249AD" },
  stepNumber: { color: "#666", fontWeight: "600" },
  activeStepNumber: { color: "#fff" },
  stepLabel: { fontSize: 10, textAlign: "center" },
  stepTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  text: { color: "#555", lineHeight: 20 },
  bold: { fontWeight: "700" },
  sectionHeader: { fontSize: 16, fontWeight: "700", marginTop: 10 },
  list: { paddingLeft: 12, marginTop: 4 },
  listItem: { marginBottom: 4, color: "#555" },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 12,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: "#fafafa",
  },
  uploadBoxSmall: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: "#fafafa",
  },
  fileName: { marginTop: 8, fontWeight: "600", color: "#333" },
  successText: { fontSize: 12, color: "#00C881", marginTop: 2 },
  uploadText: { marginTop: 8, color: "#666", textAlign: "center" },
  previewSmall: { width: 80, height: 80, marginTop: 8, borderRadius: 8 },
  cardInner: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fafafa",
  },
  cardTitle: { fontWeight: "700", fontSize: 15, marginBottom: 6 },
  validateButton: {
    backgroundColor: "#0249AD",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  validateText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  submitButton: {
    backgroundColor: "#0249AD",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  navButton: {
    backgroundColor: "#eee",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  navButtonPrimary: {
    backgroundColor: "#0249AD",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  navButtonText: { color: "#333", fontWeight: "600" },
  navButtonTextPrimary: { color: "#fff", fontWeight: "600" },
});
