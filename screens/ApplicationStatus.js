import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../config/api";

const statusBadgeColors = {
  Approved: "#15803d",
  Rejected: "#b91c1c",
  Pending: "#b45309",
};

export default function ApplicationStatus() {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      setError(null);

      const sessionRaw = await AsyncStorage.getItem("session");
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;
      const studentId =
        session?.student_id ||
        session?.Student_id ||
        session?.login_id ||
        session?.user?.student_id ||
        session?.user?.Student_id ||
        null;

      if (!studentId) {
        throw new Error("Unable to determine student ID.");
      }

      const response = await fetch(
        `${BASE_URL}/get_application_status.php?student_id=${encodeURIComponent(
          studentId
        )}`
      );
      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to fetch application status.");
      }

      const rawList = Array.isArray(data.applications)
        ? data.applications
        : data.application_id
        ? [data]
        : [];

      const normalized = rawList.map((item, idx) => ({
        id:
          item.application_id ||
          item.Application_id ||
          item.id ||
          idx + 1,
        type: item.type || item.Type || item.file_name || item.File_name || "Application",
        gwa: item.gwa ?? item.GWA ?? "N/A",
        rank: item.rank || item.Rank || "N/A",
        status: item.status || item.Status || "Pending",
      }));
      setApplications(normalized);
    } catch (err) {
      setError(err.message || "Failed to load application status.");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = (status = "") => {
    const normalized = status.trim() || "Pending";
    const color = statusBadgeColors[normalized] || "#4b5563";
    return (
      <View style={[styles.statusBadge, { backgroundColor: color }]}>
        <Text style={styles.statusBadgeText}>{normalized}</Text>
      </View>
    );
  };

  const renderRows = () => {
    if (applications.length === 0) {
      return (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No applications found.</Text>
        </View>
      );
    }

    return applications.map((item, index) => (
      <View key={item.id || index} style={styles.tableRow}>
        <Text style={[styles.cell, styles.cellIndex]}>{index + 1}</Text>
        <Text
          style={[styles.cell, styles.cellType]}
          numberOfLines={1}
        >
          {item.type || item.file_name || "Application"}
        </Text>
        <Text style={[styles.cell, styles.cellGwa]}>
          {item.gwa ?? "N/A"}
        </Text>
        <Text style={[styles.cell, styles.cellRank]}>
          {item.rank || "N/A"}
        </Text>
        <View style={[styles.cell, styles.cellStatus]}>
          {renderStatusBadge(item.status)}
        </View>
        <View style={[styles.cell, styles.cellAction]}>
          <TouchableOpacity style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={16} color="#b91c1c" />
          </TouchableOpacity>
        </View>
      </View>
    ));
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
      <Text style={styles.title}>Application Status</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStatuses}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.tableCard}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.headerCell, styles.cellIndex]}>#</Text>
            <Text style={[styles.headerCell, styles.cellType]}>Type</Text>
            <Text style={[styles.headerCell, styles.cellGwa]}>GWA</Text>
            <Text style={[styles.headerCell, styles.cellRank]}>Rank</Text>
            <Text style={[styles.headerCell, styles.cellStatus]}>Status</Text>
            <Text style={[styles.headerCell, styles.cellAction]}>Action</Text>
          </View>
          {renderRows()}
        </View>
      )}
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
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  errorText: {
    color: "#991b1b",
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: "#DC143C",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
  },
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeader: {
    backgroundColor: "#f1f5f9",
  },
  headerCell: {
    fontWeight: "700",
    color: "#1f2937",
    fontSize: 12,
  },
  cell: {
    fontSize: 13,
    color: "#1f2937",
  },
  cellIndex: { width: 30 },
  cellType: { flex: 1 },
  cellGwa: { width: 80, textAlign: "center" },
  cellRank: { width: 120, textAlign: "center" },
  cellStatus: { width: 120, alignItems: "center" },
  cellAction: { width: 70, justifyContent: "center", alignItems: "center" },
  emptyRow: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#b91c1c",
    borderRadius: 8,
    padding: 6,
  },
});
