import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";

export default function ApplicationStatus() {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    setTimeout(() => {
      const fetchedData = [
        { id: 1, type: "Graduation Application for 2025-2026", dateApplied: "2025-10-01", semester: "1st Semester", schoolYear: "2025-2026", status: "Pending" },
        { id: 2, type: "Scholarship Application", dateApplied: "2025-09-15", semester: "2nd Semester", schoolYear: "2024-2025", status: "Approved" },
        { id: 3, type: "Certificate Request", dateApplied: "2025-09-20", semester: "1st Semester", schoolYear: "2025-2026", status: "Rejected" },
        { id: 4, type: "Transcript Request", dateApplied: "2025-10-05", semester: "2nd Semester", schoolYear: "2025-2026", status: "Pending" },
      ];
      setApplications(fetchedData);
      setLoading(false);
    }, 1500);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
        case "Approved": return "#28a745"; // green
        case "Rejected": return "#FF4C4C"; // red
        case "Pending": return "#FFA500"; // orange
        default: return "#000";
    }
    };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading your applications...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Applications</Text>

      {applications.map((app, index) => (
        <View key={app.id} style={[styles.card, index % 2 === 0 ? styles.evenCard : styles.oddCard]}>
          <Text style={styles.type}>{app.type}</Text>

          <View style={styles.detailsRow}>
            <Text style={styles.detail}><Text style={styles.label}>Date:</Text> {app.dateApplied}</Text>
            <Text style={styles.detail}><Text style={styles.label}>Semester:</Text> {app.semester}</Text>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.detail}><Text style={styles.label}>School Year:</Text> {app.schoolYear}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(app.status) }]}>
              <Text style={styles.statusText}>{app.status}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f8faff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#DC143C",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#DC143C",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  evenCard: {
    backgroundColor: "#e6f0ff",
  },
  oddCard: {
    backgroundColor: "#ffffff",
  },
  type: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#DC143C",
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    flexWrap: "wrap",
  },
  detail: {
    fontSize: 14,
    flexShrink: 1,
    marginBottom: 4,
  },
  label: {
    fontWeight: "bold",
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  statusText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
});
