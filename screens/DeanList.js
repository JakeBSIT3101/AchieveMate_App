import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import styles from "../styles"; // You can adjust or extend

export default function DeanList() {
  const [gradeSlip, setGradeSlip] = useState(null);
  const [cor, setCor] = useState(null);

  const pickDocument = async (type) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.type === "success") {
        if (type === "gradeSlip") setGradeSlip(result);
        else setCor(result);
      }
    } catch (error) {
      console.error("❌ Document picker error:", error);
    }
  };

  const handleSubmit = () => {
    if (!gradeSlip || !cor) {
      Alert.alert("Missing Files", "Please upload both Grade Slip and COR.");
      return;
    }

    // 🧠 You can implement file upload logic here (e.g., to FormData)
    Alert.alert("Submitted", "Your application has been submitted.");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", color: "#0249AD", marginBottom: 10 }}>
        🏅 Apply for Dean's List
      </Text>

      <Text style={{ marginBottom: 20, fontSize: 14, color: "#444" }}>
        To apply, please upload the following required documents:
      </Text>

      {/* Grade Slip Upload */}
      <View style={styles.uploadContainer}>
        <Text style={styles.uploadLabel}>📘 Grade Slip (PDF)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickDocument("gradeSlip")}
        >
          <Icon name="file-upload-outline" size={20} color="#fff" />
          <Text style={styles.uploadButtonText}>Upload Grade Slip</Text>
        </TouchableOpacity>
        {gradeSlip && (
          <Text style={styles.fileNameText}>{gradeSlip.name}</Text>
        )}
      </View>

      {/* COR Upload */}
      <View style={styles.uploadContainer}>
        <Text style={styles.uploadLabel}>📄 Certificate of Registration (PDF)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickDocument("cor")}
        >
          <Icon name="file-upload-outline" size={20} color="#fff" />
          <Text style={styles.uploadButtonText}>Upload COR</Text>
        </TouchableOpacity>
        {cor && <Text style={styles.fileNameText}>{cor.name}</Text>}
      </View>

      {/* Submit Button */}
      <TouchableOpacity style={styles.blueButton} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Submit Application</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
