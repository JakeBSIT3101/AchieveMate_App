import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { WebView } from "react-native-webview";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function PdfUploader({ label, fileUri, onPickFile, style, webviewHeight = 400 }) {
  const [base64Pdf, setBase64Pdf] = useState(null);

  useEffect(() => {
    if (fileUri) loadPdf(fileUri);
  }, [fileUri]);

  const loadPdf = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setBase64Pdf(`data:application/pdf;base64,${base64}`);
    } catch (error) {
      console.error("Failed to load PDF:", error);
      Alert.alert("Error", "Failed to load PDF content.");
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (result.type === "cancel") return;

      // Support both old and new DocumentPicker formats
      const file = result.assets ? result.assets[0] : result;

      onPickFile(file.uri); // Send the picked file URI to parent
    } catch (error) {
      console.error("File picker error:", error);
      Alert.alert("Error", "Failed to pick file.");
    }
  };

  return (
    <View style={style}>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>{label}</Text>

      <TouchableOpacity
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
        }}
        onPress={handlePickFile}
      >
        {fileUri ? (
          <View style={{ alignItems: "center" }}>
            <Icon name="file-pdf-box" size={50} color="#e74c3c" />
            <Text style={{ marginTop: 8, fontWeight: "600", color: "#333" }}>
              {fileUri.split("/").pop()}
            </Text>
            <Text style={{ fontSize: 12, color: "#666" }}>PDF uploaded successfully</Text>
          </View>
        ) : (
          <>
            <Icon name="upload" size={40} color="#666" />
            <Text style={{ marginTop: 8, color: "#666", fontWeight: "600" }}>
              Tap to upload {label.toLowerCase()}
            </Text>
            <Text style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Only .pdf files are accepted</Text>
          </>
        )}
      </TouchableOpacity>

      {base64Pdf && (
        <View style={{ marginTop: 12, height: webviewHeight }}>
          <WebView
            originWhitelist={["*"]}
            source={{ uri: base64Pdf }}
            style={{ flex: 1 }}
            startInLoadingState
          />
        </View>
      )}
    </View>
  );
}
