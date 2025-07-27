import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import styles from "../styles";

export default function LatinHonors() {
  const [gpa, setGpa] = useState("");
  const [reason, setReason] = useState("");

  const [gradesFile, setGradesFile] = useState(null);
  const [moralFile, setMoralFile] = useState(null);
  const [ojtFile, setOjtFile] = useState(null);
  const [brgyFile, setBrgyFile] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickDocument = async (setter) => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
    if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
      setter(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!gpa || !reason || !gradesFile || !moralFile || !brgyFile) {
      Alert.alert("Incomplete", "Please complete all required fields and upload all required documents.");
      return;
    }

    try {
      setIsSubmitting(true);
      const userId = await AsyncStorage.getItem("userId");
      const formData = new FormData();

      formData.append("userId", userId);
      formData.append("gpa", gpa);
      formData.append("reason", reason);
      formData.append("gradesFile", {
        uri: gradesFile.uri,
        name: gradesFile.name,
        type: gradesFile.mimeType || "application/pdf",
      });
      formData.append("moralFile", {
        uri: moralFile.uri,
        name: moralFile.name,
        type: moralFile.mimeType || "application/pdf",
      });
      if (ojtFile) {
        formData.append("ojtFile", {
          uri: ojtFile.uri,
          name: ojtFile.name,
          type: ojtFile.mimeType || "application/pdf",
        });
      }
      formData.append("brgyFile", {
        uri: brgyFile.uri,
        name: brgyFile.name,
        type: brgyFile.mimeType || "application/pdf",
      });

      const response = await fetch("http://192.168.18.250:3000/apply-latin-honor", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Your application has been submitted.");
        setGpa("");
        setReason("");
        setGradesFile(null);
        setMoralFile(null);
        setOjtFile(null);
        setBrgyFile(null);
      } else {
        Alert.alert("Error", result.message || "Submission failed.");
      }
    } catch (err) {
      console.error("❌ Error submitting:", err);
      Alert.alert("Error", "Something went wrong during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUploadField = (label, file, setter, required = true) => (
    <View style={{ marginBottom: 15 }}>
      <Text style={styles.uploadLabel}>
        📄 {label} {required ? "*" : "(Optional)"}
      </Text>
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => pickDocument(setter)}
      >
        <Text style={styles.uploadButtonText}>Select File</Text>
      </TouchableOpacity>
      {file && <Text style={styles.fileNameText}>📌 {file.name}</Text>}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.staticContainer}>
      <View style={[styles.card]}>
        <Text style={styles.welcomeText}>🎓 Apply for Latin Honors</Text>
        <Text style={styles.infoText}>
          Please provide your GPA, a short justification, and upload the required documents.
        </Text>

        {/* GPA Field */}
        <Text style={styles.uploadLabel}>GPA *</Text>
        <TextInput
          style={[styles.input, styles.blueField]}
          placeholder="e.g. 1.25"
          keyboardType="numeric"
          value={gpa}
          onChangeText={setGpa}
        />

        {/* Reason Field */}
        <Text style={styles.uploadLabel}>Reason *</Text>
        <TextInput
          style={[
            styles.input,
            styles.blueField,
            { height: 90, textAlignVertical: "top" },
          ]}
          placeholder="Explain why you deserve to be recognized."
          multiline
          value={reason}
          onChangeText={setReason}
        />

        {/* Upload Section */}
        <View style={[styles.uploadContainer, { marginTop: 25 }]}>
          <Text style={[styles.uploadLabel, { marginBottom: 12, fontWeight: "bold", fontSize: 16 }]}>
            Upload Required Documents
          </Text>

          {renderUploadField("Complete Grades (PDF)", gradesFile, setGradesFile)}
          {renderUploadField("Good Moral Character Certificate", moralFile, setMoralFile)}
          {renderUploadField("OJT Certificate", ojtFile, setOjtFile, false)}
          {renderUploadField("Barangay Clearance", brgyFile, setBrgyFile)}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.blueButton, { marginTop: 25 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
