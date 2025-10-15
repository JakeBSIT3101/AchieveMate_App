import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";

export default function ApplicationForLatinHonors() {
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleSubmit = () => {
    if (!fullName || !studentId || !program || !yearLevel) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    // Here you can call your API to submit the application
    Alert.alert("Success", "Your Latin Honors application has been submitted.");
    
    // Reset form
    setFullName("");
    setStudentId("");
    setProgram("");
    setYearLevel("");
    setRemarks("");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Application for Latin Honors</Text>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your full name"
        value={fullName}
        onChangeText={setFullName}
      />

      <Text style={styles.label}>Student ID *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your Student ID"
        value={studentId}
        onChangeText={setStudentId}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Program *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your Program"
        value={program}
        onChangeText={setProgram}
      />

      <Text style={styles.label}>Year Level *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your Year Level"
        value={yearLevel}
        onChangeText={setYearLevel}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Remarks (Optional)</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Additional remarks"
        value={remarks}
        onChangeText={setRemarks}
        multiline
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Submit Application</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f8faff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E90FF",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  submitButton: {
    backgroundColor: "#1E90FF",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
