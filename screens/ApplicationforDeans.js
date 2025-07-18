import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Animated,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import styles from "../styles";
import { OCR_URL } from "../config/api";
import Icon from "react-native-vector-icons/Feather";

export default function ApplicationforDeans() {
  const [currentStep, setCurrentStep] = useState(1);
  const [ocrResult, setOcrResult] = useState("");
  const [gradesImageUri, setGradesImageUri] = useState(null);
  const [certificateImageUri, setCertificateImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const steps = [
    "Guideline",
    "Upload Certificate of Enrollment",
    "Upload Copy of Grades",
  ];

  const animateProgress = (progress) => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleUpload = async (docType) => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Denied",
        "Permission to access gallery is required!"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const image = result.assets[0];

      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("image", {
        uri: image.uri,
        name: "document.jpg",
        type: "image/jpeg",
      });

      setUploading(true);
      setUploadProgress(0);
      animateProgress(0);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = event.loaded / event.total;
          setUploadProgress(progress);
          animateProgress(progress);
        }
      };

      xhr.onload = () => {
        setUploading(false);
        if (xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          setOcrResult(json.result);

          if (docType === "Copy of Grades") {
            setGradesImageUri(image.uri);
          } else if (docType === "Certificate of Enrollment") {
            setCertificateImageUri(image.uri);
          }

          Alert.alert("Uploaded", `${docType} uploaded successfully.`);
        } else {
          const json = JSON.parse(xhr.response);
          Alert.alert("Upload Failed", json.error || "Something went wrong.");
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        Alert.alert("Network Error", "An error occurred while uploading.");
      };

      xhr.open("POST", `${OCR_URL}/upload`);
      xhr.send(formData);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container1}
      keyboardShouldPersistTaps="handled"
    >
      {/* Step Progress */}
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

      {/* Step 1: Guidelines */}
      {currentStep === 1 && (
        <View style={styles.guidelineCard}>
          <Text style={styles.guidelineHeader}>📌 Application Guidelines</Text>
          {[
            "Submit all documents clearly scanned.",
            "Ensure documents are updated.",
            "Apply before the deadline.",
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
            <Text style={styles.formulaText}>WA = total WG / total units</Text>
            <Text style={styles.formulaText}>WA = Weighted Average</Text>
            <Text style={styles.formulaText}>WG = Weighted Grade</Text>
          </View>

          <TouchableOpacity
            style={[styles.blueButtonupload, { marginTop: 20 }]}
            onPress={() => setCurrentStep(2)}
          >
            <Text style={styles.buttonTextupload}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 2: Upload Certificate */}
      {currentStep === 2 && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 580 }}
          >
            <TouchableOpacity
              style={styles.blueButtonupload}
              onPress={() => handleUpload("Certificate of Enrollment")}
            >
              <Text style={styles.uploadButtonText}>
                Upload Certificate of Enrollment
              </Text>
            </TouchableOpacity>

            {uploading && (
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
            )}

            {certificateImageUri && (
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Image
                  source={{ uri: certificateImageUri }}
                  style={{
                    width: 350,
                    height: 450,
                    resizeMode: "contain",
                    borderRadius: 10,
                    marginTop: -100,
                    marginBottom: 20,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setCertificateImageUri(null)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#ff4d4d",
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    marginTop: -105,
                    marginBottom: -7000,
                  }}
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
            )}
          </ScrollView>

          <View style={styles.stepFormStickyFooter}>
            <TouchableOpacity
              style={styles.stepFormNavBtn}
              onPress={() => setCurrentStep(1)}
            >
              <Text style={styles.navButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stepFormNavBtn,
                { backgroundColor: certificateImageUri ? "#007bff" : "#ccc" },
              ]}
              onPress={() => setCurrentStep(3)}
              disabled={!certificateImageUri}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {currentStep === 3 && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 180 }}
          >
            <TouchableOpacity
              style={styles.blueButtonupload}
              onPress={() => handleUpload("Copy of Grades")}
            >
              <Text style={styles.uploadButtonText}>Upload Copy of Grades</Text>
            </TouchableOpacity>

            {gradesImageUri && (
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Image
                  source={{ uri: gradesImageUri }}
                  style={{
                    width: 350,
                    height: 450,
                    resizeMode: "contain",
                    borderRadius: 10,
                    marginBottom: 20,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setGradesImageUri(null)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#ff4d4d",
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    marginTop: -60,
                  }}
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
            )}
          </ScrollView>

          {/* Sticky bottom nav */}
          <View style={styles.navStickyContainer}>
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
              onPress={() => setCurrentStep(4)} // or whatever the next step is
              disabled={!gradesImageUri}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
