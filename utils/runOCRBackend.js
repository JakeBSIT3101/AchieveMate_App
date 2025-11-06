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

    const response = await fetch("http://192.168.1.25:5000/ocr", {
      method: "POST",
      body: formData,
      // DO NOT set Content-Type manually
    });

    console.log("OCR Response status:", response.status);
    const textResponse = await response.text();
    console.log("OCR Response text:", textResponse);

    if (!response.ok) throw new Error("OCR failed");

    const data = JSON.parse(textResponse); // parse JSON manually
    return data.text || "No text detected";
  } catch (error) {
    console.error("runOCRBackend error:", error);
    return null;
  }
};
