// screens/ApplicationForGraduation.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  CheckBox,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function ApplicationForGraduation() {
  const [currentStep, setCurrentStep] = useState(1);
  const [grades, setGrades] = useState(null);
  const [coe, setCoe] = useState(null);
  const [approvalSheet, setApprovalSheet] = useState(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [consent, setConsent] = useState(false);

  const steps = [
    "Guidelines",
    "Upload Grades",
    "Upload COE",
    "Validation & Info",
    "Review & Submit",
  ];

  const pickImage = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === "grades") setGrades(uri);
      if (type === "coe") setCoe(uri);
      if (type === "approval") setApprovalSheet(uri);
      if (type === "attachment")
        setAttachments((prev) => [...prev, { uri, id: Date.now() }]);
    }
  };

  const nextStep = () =>
    setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
  const prevStep = () =>
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Application for Graduation</Text>

      {/* Progress Indicator */}
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

      {/* Step Content */}
      <View style={styles.card}>
        {/* STEP 1 */}
        {currentStep === 1 && (
          <View>
            <Text style={styles.stepTitle}>Step 1: Guidelines</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>DATA PRIVACY AGREEMENT</Text>
              <Text style={styles.cardText}>
                In submitting this form, I agree that my details be utilized for
                evaluating my academic records and for other purposes relevant
                to my graduation. I also agree that the information I have
                indicated in this form be made available to the university, and
                to other external agencies, groups and individuals for
                scholastic, research, and employment purposes.
              </Text>
              <Text style={styles.signature}>
                Signature over Printed Name of Student
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>REMINDER</Text>
              <Text style={styles.cardText}>
                It is understood that should this application be approved, the
                candidate <Text style={styles.bold}>must comply with all requirements for graduation</Text> before the Academic Council Meeting, such as:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>1. Photocopy of the Approval Sheet of Thesis/Dissertation</Text>
                <Text style={styles.listItem}>2. Certificate of Submission of hardbound copy of thesis in the Library</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>SYSTEM-BASED PROCEDURE</Text>
              <Text style={styles.cardText}>
                The online steps for graduation application:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>1. Log in to AchieveMate and open the “Application for Graduation” section.</Text>
                <Text style={styles.listItem}>2. Review the guidelines and agree to the Data Privacy Agreement.</Text>
                <Text style={styles.listItem}>3. Upload your grades.</Text>
                <Text style={styles.listItem}>4. Upload your Certificate of Current Enrollment.</Text>
                <Text style={styles.listItem}>5. System validates grades and identifies missing subjects.</Text>
                <Text style={styles.listItem}>6. Fill in Guardian Information and attach required documents.</Text>
                <Text style={styles.listItem}>7. (Optional) Upload Approval Sheet.</Text>
                <Text style={styles.listItem}>8. Review any deficiencies before submission.</Text>
                <Text style={styles.listItem}>9. Wait for confirmation from Registrar’s Office.</Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 2 */}
        {currentStep === 2 && (
          <View>
            <Text style={styles.stepTitle}>Step 2: Upload Grades</Text>
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={() => pickImage("grades")}
            >
              {grades ? (
                <Image source={{ uri: grades }} style={styles.preview} />
              ) : (
                <>
                  <Icon name="upload" size={40} color="#666" />
                  <Text style={styles.uploadText}>
                    Tap to upload your grades
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3 */}
        {currentStep === 3 && (
          <View>
            <Text style={styles.stepTitle}>
              Step 3: Upload Certificate of Current Enrollment (COE)
            </Text>
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={() => pickImage("coe")}
            >
              {coe ? (
                <Image source={{ uri: coe }} style={styles.preview} />
              ) : (
                <>
                  <Icon name="upload" size={40} color="#666" />
                  <Text style={styles.uploadText}>
                    Tap to upload your COE
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4 */}
        {currentStep === 4 && (
          <View>
            <Text style={styles.stepTitle}>Step 4: Validation & Info</Text>
            <Text style={styles.text}>
              The system will validate your uploaded grades and check for missing
              subjects. Please fill out the information below:
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
              <Icon name="paperclip" size={24} color="#00C881" />
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
                <Image source={{ uri: approvalSheet }} style={styles.previewSmall} />
              ) : (
                <>
                  <Icon name="upload" size={30} color="#666" />
                  <Text style={styles.uploadText}>Upload Approval Sheet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 5 */}
        {currentStep === 5 && (
          <View>
            <Text style={styles.stepTitle}>Step 5: Review & Submit</Text>
            <Text style={styles.text}>Review your entered information:</Text>

            <View style={styles.reviewBox}>
              <Text style={styles.fileLabel}>Grades:</Text>
              {grades && <Image source={{ uri: grades }} style={styles.previewSmall} />}
              <Text style={styles.fileLabel}>COE:</Text>
              {coe && <Image source={{ uri: coe }} style={styles.previewSmall} />}
              <Text style={styles.fileLabel}>Guardian:</Text>
              <Text style={styles.text}>{guardianName || "N/A"}</Text>
              <Text style={styles.text}>{guardianContact || "N/A"}</Text>
            </View>

            <View style={styles.checkboxContainer}>
              <CheckBox value={consent} onValueChange={setConsent} />
              <Text style={styles.text}>
                I confirm that all details are correct and complete.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                !consent && { backgroundColor: "#aaa" },
              ]}
              disabled={!consent}
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
          <TouchableOpacity style={styles.navButtonPrimary} onPress={nextStep}>
            <Text style={styles.navButtonTextPrimary}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
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
  stepContainer: { alignItems: "center", width: "18%" },
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
  activeCircle: { borderColor: "#00C881", backgroundColor: "#00C881" },
  stepNumber: { color: "#666", fontWeight: "600" },
  activeStepNumber: { color: "#fff" },
  stepLabel: { fontSize: 10, textAlign: "center" },
  stepTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  text: { color: "#555", lineHeight: 20 },
  bullet: { color: "#333", marginVertical: 4 },
  uploadBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  uploadBoxSmall: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
    marginTop: 8,
  },
  uploadText: { marginTop: 8, color: "#666" },
  preview: { width: "100%", height: "100%", borderRadius: 12 },
  previewSmall: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginTop: 6,
  },
  inputLabel: { fontWeight: "600", marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fafafa",
  },
  attachmentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#00C881",
    borderRadius: 8,
    marginTop: 4,
  },
  attachmentText: { color: "#00C881", fontWeight: "600" },
  reviewBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  fileLabel: { fontWeight: "600", marginTop: 6 },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 12,
  },
  submitButton: {
    backgroundColor: "#00C881",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
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
    backgroundColor: "#00C881",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  navButtonText: { color: "#333", fontWeight: "600" },
  navButtonTextPrimary: { color: "#fff", fontWeight: "600" },

  /* Styles for Guidelines Section */
  cardTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  cardText: { color: "#555", lineHeight: 20, marginBottom: 6 },
  signature: { marginTop: 10, fontStyle: "italic", color: "#333" },
  list: { marginLeft: 10, marginTop: 4 },
  listItem: { marginVertical: 2, color: "#333" },
  bold: { fontWeight: "700" },
});
