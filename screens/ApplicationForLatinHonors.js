import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Provider as PaperProvider, Checkbox } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

const registrarRequirements = [
  "TOR (with remark for evaluation purposes only)",
  "Birth Certificate / PSA",
  "Library Certificate",
  "Shifter: include Honorable Dismissal from previous school.",
  "4th year / transferee cases: attach BatStateU evaluation copy if applicable.",
];

const chairpersonChecklist = [
  "Consent form / Application form (generate below)",
  "Evaluation set: updated prospectus & curriculum sheet, copy of PSA, Approval Sheet",
  "Endorsement letter to Registrar",
  "Barangay Clearance",
];

const chairpersonRequirements = [
  { key: "approvalSheet", label: "Approval Sheet", required: true },
  { key: "libraryCertificate", label: "Certificate of Library", required: true },
  { key: "barangayClearance", label: "Barangay Clearance", required: false },
  { key: "birthCertificate", label: "Birth Certificate", required: false },
];

const ApplicationForLatinHonor = () => {
  const [registrarExpanded, setRegistrarExpanded] = useState(true);
  const [chairExpanded, setChairExpanded] = useState(true);
  const [requirements, setRequirements] = useState(() => {
    const initial = {};
    chairpersonRequirements.forEach((item) => {
      initial[item.key] = { file: null, toFollow: false };
    });
    return initial;
  });

  const toggleSection = (sectionSetter) => {
    sectionSetter((prev) => !prev);
  };

  const handleUpload = async (key) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.type === "cancel") return;
      const file = result.assets ? result.assets[0] : result;
      setRequirements((prev) => ({
        ...prev,
        [key]: { ...prev[key], file, toFollow: false },
      }));
    } catch (error) {
      console.warn("Upload error:", error);
    }
  };

  const toggleFollow = (key) => {
    setRequirements((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        toFollow: !prev[key].toFollow,
        file: prev[key].toFollow ? prev[key].file : null,
      },
    }));
  };

  const requirementCards = useMemo(
    () =>
      chairpersonRequirements.map((item) => {
        const data = requirements[item.key];
        return (
          <View key={item.key} style={styles.requirementCard}>
            <Text style={styles.requirementTitle}>
              {item.label}
              {item.required ? (
                <Text style={styles.required}> *</Text>
              ) : (
                <Text style={styles.optional}> (optional)</Text>
              )}
            </Text>
            <Text style={styles.requirementHint}>PDF or Image (JPG/PNG)</Text>
            <TouchableOpacity
              style={styles.uploadInput}
              onPress={() => handleUpload(item.key)}
              disabled={data.toFollow}
            >
              <Text style={styles.uploadButtonText}>Choose File</Text>
              <Text style={styles.fileName}>
                {data.file?.name || "No file chosen"}
              </Text>
            </TouchableOpacity>
            <View style={styles.followRow}>
              <Checkbox
                status={data.toFollow ? "checked" : "unchecked"}
                onPress={() => toggleFollow(item.key)}
                color="#1d4ed8"
              />
              <Text style={styles.followText}>Mark as To Follow</Text>
            </View>
          </View>
        );
      }),
    [requirements]
  );

  return (
    <PaperProvider>
      <ScrollView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Latin Honors Requirements</Text>
          <Text style={styles.headerTagline}>
            Upload the following for Latin Honors evaluation.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection(setRegistrarExpanded)}
          >
            <Text style={styles.sectionHeaderText}>
              Registrar Requirements (depends on department)
            </Text>
            <Ionicons
              name={registrarExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color="#1d4ed8"
            />
          </TouchableOpacity>
          {registrarExpanded && (
            <View style={styles.sectionBody}>
              {registrarRequirements.map((req, idx) => (
                <Text key={idx} style={styles.listEntry}>
                  {"\u2022"} {req}
                </Text>
              ))}
              <Text style={styles.note}>
                Note: some colleges may ask for additional paperwork - follow your department memo.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection(setChairExpanded)}
          >
            <Text style={styles.sectionHeaderText}>
              Chairperson (Latin Honors) Requirements
            </Text>
            <Ionicons
              name={chairExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color="#1d4ed8"
            />
          </TouchableOpacity>
          {chairExpanded && (
            <View style={{ padding: 16 }}>
              {chairpersonChecklist.map((line, idx) => (
                <Text key={idx} style={styles.listEntry}>
                  {"\u2022"} {line}
                </Text>
              ))}
              <View style={styles.reminderCard}>
                <Text style={styles.reminderLabel}>Eligibility reminder (example rule):</Text>
                <Text style={styles.reminderText}>
                  If the student has a grade of 2.25 in any subject, they do not qualify for Cum Laude even
                  with a GWA of 1.75. Apply equivalent thresholds to higher honors.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.requirementGrid}>{requirementCards}</View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryButton}>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Save Requirements</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <Ionicons name="document-text-outline" size={18} color="#1d4ed8" />
            <Text style={styles.secondaryButtonText}>Generate Consent</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f6f6",
    padding: 16,
  },
  header: {
    backgroundColor: "#991b1b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerTagline: {
    color: "#fcd34d",
    marginTop: 6,
    fontSize: 13,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#eff6ff",
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  listEntry: {
    color: "#1f2937",
    marginBottom: 6,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  reminderCard: {
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  reminderLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  reminderText: {
    fontSize: 12,
    color: "#1e3a8a",
    marginTop: 4,
  },
  requirementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  requirementCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  requirementTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  required: {
    color: "#dc2626",
  },
  optional: {
    color: "#6b7280",
    fontWeight: "500",
  },
  requirementHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  uploadInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
  },
  uploadButtonText: {
    color: "#1d4ed8",
    fontWeight: "600",
  },
  fileName: {
    marginTop: 6,
    fontSize: 12,
    color: "#374151",
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  followText: {
    color: "#1f2937",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#1d4ed8",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
});

export default ApplicationForLatinHonor;
