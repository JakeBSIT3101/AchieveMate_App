import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
} from "react-native";
import PdfUploader from "../components/PdfUploader";
import * as ImagePicker from "expo-image-picker";
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from "expo-document-picker";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Checkbox, Provider as PaperProvider } from "react-native-paper";

export default function ApplicationForGraduation() {
  const [currentStep, setCurrentStep] = useState(1);
  const [grades, setGrades] = useState(null);
  const [coe, setCoe] = useState(null);
  const [approvalSheet, setApprovalSheet] = useState(null);
  const [consent, setConsent] = useState(false);
  const [step1Consent, setStep1Consent] = useState(false);

  // Guardian and attachments
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [attachments, setAttachments] = useState([]);

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
    "Upload Grades",
    "Upload COR",
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

  const pickFile = async (type) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      // If user cancels
      if (result.canceled || result.type === "cancel") return;

      // Support for both new and old expo-document-picker formats
      const file = result.assets ? result.assets[0] : result;
      const fileUri = file.uri;
      const fileName = file.name || "document.pdf";

      console.log("Picked file:", fileUri);

      // Save to cache so WebView can access it safely
      const newPath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({
        from: fileUri,
        to: newPath,
      });

      // Update the correct state
      if (type === "grades") {
        setGrades(newPath);
      } else if (type === "coe") {
        setCoe(newPath);
      }

      Alert.alert("Success", `${fileName} uploaded successfully!`);
    } catch (error) {
      console.error("File picker error:", error);
      Alert.alert("Error", "Failed to pick file.");
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
      setGuardianName("");
      setGuardianContact("");
      setAttachments([]);
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

            {/* Graduation Guidelines */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Graduation Guidelines</Text>
              <Text style={styles.cardText}>
                A student’s completion of academic requirements is recognized through the
                Graduation Application Process, which ensures that only qualified candidates
                are endorsed for graduation.
              </Text>

              <View style={styles.list}>
                <Text style={styles.listItem}>
                  • apply for graduation within the prescribed schedule set by the university;
                </Text>
                <Text style={styles.listItem}>
                  • upload the required documents in the system, including:
                </Text>
                <Text style={styles.listItem}>  - a copy of the Final Grades, and</Text>
                <Text style={styles.listItem}>
                    - a Certificate of Current Enrollment (or Certificate of Registration);
                </Text>
                <Text style={styles.listItem}>
                  • ensure that all uploaded grades correspond to the approved curriculum and
                  that no subjects or grades are missing;
                </Text>
                <Text style={styles.listItem}>
                  • if only the OJT (On-the-Job Training) grade is missing, ensure that the OJT
                  description in the Certificate of Registration matches the expected subject
                  description;
                </Text>
                <Text style={styles.listItem}>
                  • upon successful validation, wait for the system prompt indicating status,
                  such as:
                </Text>
                <Text style={styles.listItem}>
                    “Congratulations! You are eligible for the Dean’s List.”
                </Text>
                <Text style={styles.listItem}>
                    “Congratulations! You are eligible for graduation.”
                </Text>
                <Text style={styles.listItem}>
                  • once declared eligible, accomplish the following:
                </Text>
                <Text style={styles.listItem}>  - provide Guardian Information,</Text>
                <Text style={styles.listItem}>
                    - attach all required supporting documents, and
                </Text>
                <Text style={styles.listItem}>  - (optional) upload the Approval Sheet;</Text>
                <Text style={styles.listItem}>
                  • address any noted deficiencies before submitting the graduation application;
                </Text>
                <Text style={styles.listItem}>
                  • and submit the completed Graduation Application Form for Program Chair review.
                </Text>
              </View>
            </View>

            {/* Data Privacy Agreement */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>DATA PRIVACY AGREEMENT</Text>
              <Text style={styles.cardText}>
                In submitting this form, I agree that my details be utilized for evaluating my
                academic records and for other purposes relevant to my graduation. I also agree
                that the information I have indicated in this form be made available to the
                university, and to other external agencies, groups and individuals for scholastic,
                research, and employment purposes.
              </Text>
              <Text style={styles.signature}>
                Signature over Printed Name of Student
              </Text>

              {/* Checkbox */}
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

          {/* STEP 2 - Upload Grades */}
          {currentStep === 2 && (
            <View>
              <Text style={styles.stepTitle}>Step 2: Upload Copy of Grades</Text>

              <Text style={styles.text}>
                Upload your Copy of Grades{"\n"}
                Accepted format: PDF only{"\n"}
                Make sure the file is clear, complete, and official.{"\n"}
                Example filename: Lastname_Firstname_Grades.pdf
              </Text>

              <PdfUploader
                label="Copy of Grades"
                fileUri={grades}
                onPickFile={(uri) => setGrades(uri)}
                webviewHeight={400}
              />
            </View>
          )}

         {/* STEP 3 - Upload COR */}
          {currentStep === 3 && (
            <PdfUploader
              label="Certificate of Current Enrollment (COR)"
              fileUri={coe}
              onPickFile={(uri) => setCoe(uri)}
              webviewHeight={400}
            />
          )}

          {/* STEP 4 - Application Form */}
          {currentStep === 4 && (
            <View>
              <Text style={styles.stepTitle}>Step 4: Fill Out Application Form</Text>

              <Text style={styles.sectionHeader}>Personal Information</Text>
              {[
                { key: "surname", placeholder: "e.g. De la Cruz" },
                { key: "firstName", placeholder: "e.g. John" },
                { key: "middleName", placeholder: "e.g. Martis" },
                { key: "extensionName", placeholder: "e.g. Jr." },
                { key: "srCode", placeholder: "e.g. 22-*****" },
                { key: "birthDate", placeholder: "e.g. 2003-05-14" },
                { key: "placeOfBirth", placeholder: "e.g. Nasugbu, Batangas" },
                { key: "homeAddress", placeholder: "e.g. Brgy. 7, Nasugbu, Batangas" },
                { key: "zipCode", placeholder: "e.g. 4210" },
                { key: "contactNumber", placeholder: "e.g. 09171234567" },
                { key: "emailAddress", placeholder: "e.g. john@example.com" },
              ].map((field) => (
                <View key={field.key} style={{ marginBottom: 8 }}>
                  <Text style={styles.inputLabel}>{field.key.replace(/([A-Z])/g, " $1")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    value={form[field.key]}
                    onChangeText={(v) => updateField(field.key, v)}
                  />
                </View>
              ))}

              {/* ADD: Secondary and Elementary School Information */}
              <Text style={[styles.sectionHeader, { marginTop: 12 }]}>
                Secondary School Graduated
              </Text>
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.inputLabel}>School Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Nasugbu National High School"
                  value={form.secondarySchool}
                  onChangeText={(v) => updateField("secondarySchool", v)}
                />
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.inputLabel}>Year Graduated</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2019"
                  value={form.secondaryYear}
                  onChangeText={(v) => updateField("secondaryYear", v)}
                  keyboardType="numeric"
                />
              </View>

              <Text style={[styles.sectionHeader, { marginTop: 12 }]}>
                Elementary School Graduated
              </Text>
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.inputLabel}>School Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Nasugbu Elementary School"
                  value={form.elementarySchool}
                  onChangeText={(v) => updateField("elementarySchool", v)}
                />
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.inputLabel}>Year Graduated</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2013"
                  value={form.elementaryYear}
                  onChangeText={(v) => updateField("elementaryYear", v)}
                  keyboardType="numeric"
                />
              </View>

              <Text style={[styles.sectionHeader, { marginTop: 12 }]}>
                Date of Graduation (choose)
              </Text>
              {["gradDecember", "gradMay", "gradMidterm"].map((grad) => (
                <View style={styles.gradRow} key={grad}>
                  <Checkbox
                    status={form[grad + "Checked"] ? "checked" : "unchecked"}
                    onPress={() => toggleGrad(grad + "Checked")}
                    color="#00C881"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>{grad.replace("grad", "")}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 2025"
                      value={form[grad + "Year"]}
                      onChangeText={(v) => updateField(grad + "Year", v)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))}

              <Text style={[styles.sectionHeader, { marginTop: 12 }]}>
                College / Program
              </Text>
              {["Enter College Name", "Enter Program Name", "Enter Major Name"].map((field) => (
                <View key={field}>
                  <Text style={styles.inputLabel}>{field}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={field}
                    value={form[field]}
                    onChangeText={(v) => updateField(field, v)}
                  />
                </View>
              ))}
            </View>
          )}

          {/* STEP 5 - Validation & Info */}
          {currentStep === 5 && (
            <View>
              <Text style={styles.stepTitle}>Step 5: Validation & Info</Text>

              <Text style={styles.text}>
                The system will validate your uploaded grades and check for missing subjects. 
                Please fill out the information below:
              </Text>

              <Text style={styles.inputLabel}>Guardian Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter guardian name"
                value={guardianName}
                onChangeText={setGuardianName}
              />

              <Text style={styles.inputLabel}>Guardian Contact</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter contact number"
                value={guardianContact}
                onChangeText={setGuardianContact}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Attachments (Required)</Text>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={() => pickImage("attachment")}
              >
                <Icon name="paperclip" size={24} color="#0249AD" />
                <Text style={styles.attachmentText}>Attach Document</Text>
              </TouchableOpacity>

              {attachments.map((file) => (
                <Image
                  key={file.id}
                  source={{ uri: file.uri }}
                  style={styles.previewSmall}
                />
              ))}

              <Text style={styles.inputLabel}>(Optional) Approval Sheet</Text>
              <TouchableOpacity
                style={styles.uploadBoxSmall}
                onPress={() => pickImage("approval")}
              >
                {approvalSheet ? (
                  <Image
                    source={{ uri: approvalSheet }}
                    style={styles.previewSmall}
                  />
                ) : (
                  <>
                    <Icon name="upload" size={30} color="#666" />
                    <Text style={styles.uploadText}>Upload Approval Sheet</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 6 - Review & Submit */}
          {currentStep === 6 && (
            <View>
              <Text style={styles.stepTitle}>Step 6: Review & Submit</Text>
              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={consent ? "checked" : "unchecked"}
                  onPress={() => setConsent(!consent)}
                  color="#00C881"
                />
                <Text style={styles.text}>
                  I confirm that all details are correct and complete.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, !consent && { backgroundColor: "#aaa" }]}
                disabled={!consent}
                onPress={() =>
                  Alert.alert("Submitted", "Your application has been submitted (mock).")
                }
              >
                <Text style={styles.submitText}>Submit Application</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, { marginTop: 10 }]}
                onPress={clearFormStorage}
              >
                <Text style={styles.navButtonText}>Clear saved form (local)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

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
  activeCircle: { borderColor: "#0249AD", backgroundColor: "#0249AD" }, // changed to BSU blue
  stepNumber: { color: "#666", fontWeight: "600" },
  activeStepNumber: { color: "#fff" },
  stepLabel: { fontSize: 10, textAlign: "center" },
  stepTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  text: { color: "#555", lineHeight: 20 },
  sectionHeader: { fontSize: 16, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  inputLabel: { fontWeight: "600", marginTop: 10, marginBottom: 4, textTransform: "capitalize" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, backgroundColor: "#fafafa" },
  gradRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  submitButton: { backgroundColor: "#0249AD", paddingVertical: 12, borderRadius: 8, alignItems: "center" }, // changed to BSU blue
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  navigation: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  navButton: { backgroundColor: "#eee", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navButtonPrimary: { backgroundColor: "#0249AD", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 }, // changed to BSU blue
  navButtonText: { color: "#333", fontWeight: "600" },
  navButtonTextPrimary: { color: "#fff", fontWeight: "600" },
  uploadBox: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 20, alignItems: "center", justifyContent: "center", marginTop: 10, backgroundColor: "#fafafa" },
  preview: { width: 120, height: 120, resizeMode: "contain", borderRadius: 8 },
  uploadText: { marginTop: 8, color: "#666" },
  attachmentButton: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginTop: 10, backgroundColor: "#fafafa" },
  attachmentText: { color: "#333", fontWeight: "600" },
  previewSmall: { width: 80, height: 80, marginTop: 8, borderRadius: 8 },
  uploadBoxSmall: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center", marginTop: 10, backgroundColor: "#fafafa" },
  cardTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  cardText: { color: "#555", lineHeight: 20 },
  signature: { marginTop: 10, fontStyle: "italic", color: "#333" },
  bold: { fontWeight: "700" },
  list: { paddingLeft: 12, marginTop: 4 },
  listItem: { marginBottom: 4, color: "#555" },
});
