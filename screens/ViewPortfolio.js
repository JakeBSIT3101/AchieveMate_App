import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../config/api";

export default function ViewPortfolio() {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState({
    student_id: null,
    full_name: null,
    email: null,
    srcode: null,
    year: null,
    contact: null,
  });
  const [studentProgress, setStudentProgress] = useState(null);
  const [trackName, setTrackName] = useState(null);

  const fetchStudentTrack = useCallback(async (studentId) => {
    if (!studentId) return;
    try {
      const res = await fetch(`${BASE_URL}/get_student_major.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("Invalid JSON from get_student_major.php!", text);
        return;
      }
      if (data.success) {
        setTrackName(data.track || null);
      } else {
        setTrackName(null);
      }
    } catch (error) {
      console.error("Error fetching student track:", error);
    }
  }, []);

  const loadStudentProgress = useCallback(async (studentId) => {
    if (!studentId) return;
    try {
      const stored = await AsyncStorage.getItem(`studentProgress_${studentId}`);
      if (stored) {
        setStudentProgress(JSON.parse(stored));
      } else {
        setStudentProgress(null);
      }
    } catch (error) {
      console.error("Error loading student progress:", error);
    }
  }, []);

  const loadProfile = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoadingProfile(true);
    }
    try {
      const raw = await AsyncStorage.getItem("session");
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session.login_id) {
        Alert.alert("Error", "Login ID not found in session");
        return;
      }

      const res = await fetch(`${BASE_URL}/getuser.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: session.login_id }),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        console.error("Invalid JSON from getuser.php!", text);
        Alert.alert("Error", "Cannot fetch student info.");
        return;
      }

      if (json.success && json.student) {
        const s = json.student;
        setProfile({
          student_id: s.Student_id,
          full_name: `${s.First_name || ""} ${s.Middle_name ? s.Middle_name + " " : ""}${s.Last_name || ""}`.trim(),
          email: s.Email,
          srcode: s.SRCODE,
          year: s.Year,
          contact: s.Contact,
        });
        session.student_id = s.Student_id;
        await AsyncStorage.setItem("session", JSON.stringify(session));
        await Promise.all([loadStudentProgress(s.Student_id), fetchStudentTrack(s.Student_id)]);
      } else {
        Alert.alert("Error", json.message || "Student info not found");
      }
    } catch (err) {
      console.error("Error fetching student info:", err);
      Alert.alert("Error", "Failed to load student info");
    } finally {
      if (showLoader) {
        setLoadingProfile(false);
      }
      setRefreshing(false);
    }
  }, [fetchStudentTrack, loadStudentProgress]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile({ showLoader: false });
  }, [loadProfile]);

  const profileYear = profile.year ? profile.year.toString().trim() : null;
  const progressYear = studentProgress?.display_year_level
    ? studentProgress.display_year_level.toString().trim()
    : null;
  const resolvedYearLevel = profileYear || progressYear || "FOURTH YEAR";

  const normalizedTrackYear = (profileYear || progressYear)
    ? (profileYear || progressYear).toUpperCase()
    : null;
  const eligibleTrackYears = ["THIRD YEAR", "FOURTH YEAR"];
  const trackDisplay =
    trackName ||
    (normalizedTrackYear &&
    eligibleTrackYears.includes(normalizedTrackYear) &&
    studentProgress?.track &&
    studentProgress.track !== "N/A"
      ? studentProgress.track
      : "Business Analytics");

  const heroSummary = [
    "FIRST SEMESTER AY 2025-2026",
    "College of Informatics and Computing Sciences - ARASOF-Nasugbu",
    `Bachelor of Science in Information Technology – ${resolvedYearLevel}`,
    trackDisplay,
  ];

  const renderEmptyCard = (title, bodyText) => (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryBody}>{bodyText}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#DC143C"
          colors={["#DC143C"]}
        />
      }
    >
      <View style={styles.heroCard}>
        <Image
          source={require("../assets/login_background.jpg")}
          style={styles.heroBackground}
          resizeMode="cover"
        />
        <View style={styles.heroContent}>
          <View style={styles.avatarWrapper}>
            <Image source={require("../assets/Diwatas.png")} style={styles.avatar} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroName}>
              {(profile.full_name || "GRADUATING STUDENT").toUpperCase()}
            </Text>
            {heroSummary.map((line, idx) => (
              <View key={idx} style={styles.heroBulletRow}>
                <Ionicons name="caret-forward" size={12} color="#111" />
                <Text style={styles.heroBulletText}>{line}</Text>
              </View>
            ))}
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>ENROLLED</Text>
            </View>
          </View>
        </View>
      </View>

      {loadingProfile && (
        <View style={styles.loadingSection}>
          <ActivityIndicator color="#DC143C" />
        </View>
      )}

      {renderEmptyCard("List of Badges", "No badges yet.")}

      <View style={styles.rowCards}>
        {renderEmptyCard("Certificates", "No certificates yet.")}
        {renderEmptyCard("List of Achievements", "No achievements yet.")}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 16,
  },
  heroCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  heroBackground: {
    width: "100%",
    height: 130,
  },
  heroContent: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    gap: 16,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#b91c1c",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  heroText: {
    flex: 1,
  },
  heroName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    color: "#111",
  },
  heroBulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  heroBulletText: {
    color: "#1f2937",
    fontSize: 12,
  },
  statusChip: {
    alignSelf: "flex-start",
    backgroundColor: "#16a34a",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  statusChipText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  loadingSection: {
    paddingVertical: 12,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    flex: 1,
  },
  summaryTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 8,
    color: "#111827",
  },
  summaryBody: {
    color: "#6b7280",
    fontSize: 13,
  },
  rowCards: {
    flexDirection: "row",
    gap: 12,
  },
});
