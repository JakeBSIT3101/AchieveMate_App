import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import styles from "../styles"; // your global styles

const sampleData = [
  {
    type: "Dean's List",
    submitted: "July 1, 2025",
    status: "Approved",
  },
  {
    type: "Latin Honor",
    submitted: "July 10, 2025",
    status: "Pending",
  },
  {
    type: "Dean's List",
    submitted: "March 15, 2025",
    status: "Rejected",
  },
];

const getStatusColor = (status) => {
  switch (status) {
    case "Approved":
      return "green";
    case "Pending":
      return "#ff9900";
    case "Rejected":
      return "red";
    default:
      return "#333";
  }
};

export default function ApplicationStatus() {
  return (
    <ScrollView contentContainerStyle={styles.staticContainer}>
      <Text style={styles.welcomeText}>Application Status</Text>

      {/* Table Header */}
      <View style={local.tableRow}>
        <Text style={[local.tableHeaderCell, { flex: 1 }]}>Type</Text>
        <Text style={[local.tableHeaderCell, { flex: 1.2 }]}>Submitted</Text>
        <Text style={[local.tableHeaderCell, { flex: 1 }]}>Status</Text>
      </View>

      {/* Table Rows */}
      {sampleData.map((item, index) => (
        <View key={index} style={local.tableRow}>
          <Text style={[local.tableCell, { flex: 1 }]}>{item.type}</Text>
          <Text style={[local.tableCell, { flex: 1.2 }]}>{item.submitted}</Text>
          <Text style={[local.tableCell, { flex: 1, color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 8,
    width: "95%",
    alignSelf: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  tableHeaderCell: {
    fontWeight: "bold",
    color: "#0249AD",
    fontSize: 13,
  },
  tableCell: {
    fontSize: 13,
    color: "#333",
  },
});