import * as DocumentPicker from "expo-document-picker";

export const runOCRBackend = async () => {
  try {
    // Pick an image file
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*" });
    if (result.type === "cancel") return null;

    const fileUri = result.uri;
    const fileName = result.name || "document.jpg";

    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: "image/jpeg",
    });

    const response = await fetch("http://192.168.18.250:5000/ocr", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (!response.ok) throw new Error("OCR failed");

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("runOCRBackend error:", error);
    return null;
  }
};
