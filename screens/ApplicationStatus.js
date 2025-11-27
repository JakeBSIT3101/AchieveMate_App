import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import styles from "../styles";
import { BASE_URL } from "../config/api";

const Row = ({ label, value }) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
    }}
  >
    <Text style={{ color: "#666", fontWeight: "600" }}>{label}</Text>
    <Text style={{ color: "#222", marginLeft: 12 }}>{value ?? "-"}</Text>
  </View>
);

const ApplicationStatus = () => {
  const [studentId, setStudentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const loadStudentId = async () => {
    try {
      const stored = await AsyncStorage.getItem("student_id");
      if (stored) {
        setStudentId(stored);
        return stored;
      }
      setError("Student ID not found. Please log in again.");
      return null;
    } catch (e) {
      setError("Unable to read stored student ID.");
      return null;
    }
  };

  const fetchApplications = async (id) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      console.log("[APP_STATUS] fetching for student_id:", id);
      const res = await fetch(
        `${BASE_URL}/application_status.php?student_id=${encodeURIComponent(
          id
        )}`
      );
      const text = await res.text();
      console.log("[APP_STATUS] raw response:", text);
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error("Server response is not valid JSON.");
      }
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e?.message || "Failed to load applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const init = async () => {
    const id = await loadStudentId();
    if (id) {
      fetchApplications(id);
    } else {
      console.log("[APP_STATUS] No stored student_id found.");
    }
  };

  useEffect(() => {
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const id = studentId || (await loadStudentId());
    if (id) {
      fetchApplications(id);
    } else {
      setRefreshing(false);
    }
  };

  const renderTable = () => {
    if (loading) {
      return (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator size="small" color="#000000" />
        </View>
      );
    }

    if (error) {
      return (
        <Text style={{ color: "9e0009", marginTop: 8, textAlign: "center" }}>
          {error}
        </Text>
      );
    }

    if (!rows.length) {
      return (
        <Text style={{ color: "#555", marginTop: 8, textAlign: "center" }}>
          No applications found.
        </Text>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View
          style={{
            minWidth: 720,
            borderWidth: 1,
            borderColor: "#e6e6e6",
            borderRadius: 10,
            overflow: "hidden",
            width: "100%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#f2f6fb",
              borderBottomWidth: 1,
              borderBottomColor: "#e6e6e6",
              paddingVertical: 10,
              paddingHorizontal: 10,
            }}
          >
            <Text style={{ flex: 0.8, fontWeight: "700", color: "#000000" }}>
              Type
            </Text>
            <Text
              style={{
                flex: 0.6,
                fontWeight: "700",
                color: "#000000",
                textAlign: "center",
              }}
            >
              GWA
            </Text>
            <Text
              style={{
                flex: 1,
                fontWeight: "700",
                color: "#000000",
                textAlign: "center",
              }}
            >
              Rank
            </Text>
            <Text
              style={{
                flex: 0.9,
                fontWeight: "700",
                color: "#000000",
                textAlign: "center",
              }}
            >
              Status
            </Text>
            <Text
              style={{
                width: 60,
                fontWeight: "700",
                color: "#000000",
                textAlign: "center",
              }}
            >
              Action
            </Text>
          </View>
          {rows.map((row) => (
            <View
              key={row.Application_id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
                backgroundColor: "#fff",
                paddingVertical: 12,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{ flex: 1.6, color: "#333", flexWrap: "wrap" }}
                numberOfLines={2}
              >
                {row.File_name || row.Type || "-"}
              </Text>
              <Text
                style={{
                  flex: 0.6,
                  color: "#333",
                  textAlign: "left",
                  flexWrap: "wrap",
                }}
                numberOfLines={1}
              >
                {row.GWA || "-"}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: "#333",
                  textAlign: "center",
                  flexWrap: "wrap",
                }}
                numberOfLines={2}
              >
                {row.Rank || "-"}
              </Text>
              <View
                style={{
                  flex: 0.9,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    backgroundColor: "#d0d7e2",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#2e4057",
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {row.Status || "-"}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: 60,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#9e0009" }}>🗑️</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f7f7f7" }}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={[styles.card, styles.stepCardFull, { width: "100%" }]}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#9e0009",
            marginBottom: 10,
          }}
        >
          Application Status
        </Text>
        {renderTable()}
      </View>
    </ScrollView>
  );
};

export default ApplicationStatus;
