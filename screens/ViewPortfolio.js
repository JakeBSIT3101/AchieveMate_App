import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import styles from "../styles";
import { BASE_URL } from "../config/api";

const certifications = [
  { title: "Frontend Developer Certificate", organization: "Meta", date: "April 2024", year: "2024", logo: require("../assets/meta.png") },
  { title: "AWS Cloud Practitioner", organization: "Amazon", date: "January 2024", year: "2024", logo: require("../assets/meta.png") },
  { title: "React Native Course", organization: "Coursera", date: "March 2023", year: "2023", logo: require("../assets/meta.png") },
];

const honors = [
  { title: "Dean’s Lister", description: "Recognized for academic excellence in 2023.", date: "December 2023" },
  { title: "Best Capstone Project", description: "Awarded for top-performing senior project.", date: "March 2024" },
];

export default function ViewPortfolio() {
  const [selectedYear, setSelectedYear] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState({
    student_id: null,
    full_name: null,
    email: null,
    srcode: null,
    year: null,
    contact: null,
  });

  // 🧠 Load profile via login_id
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const raw = await AsyncStorage.getItem("session");
        if (!raw) return;

        const session = JSON.parse(raw);
        if (!session.login_id) {
          Alert.alert("Error", "Login ID not found in session");
          setLoadingProfile(false);
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
          console.error("❌ Invalid JSON from getuser.php!", text);
          Alert.alert("Error", "Cannot fetch student info.");
          setLoadingProfile(false);
          return;
        }

        if (json.success && json.student) {
          const s = json.student;
          setProfile({
            student_id: s.Student_id,
            full_name: `${s.First_name} ${s.Middle_name ? s.Middle_name + " " : ""}${s.Last_name}`,
            email: s.Email,
            srcode: s.SRCODE,
            year: s.Year,
            contact: s.Contact,
          });

          // Save student_id for later use
          session.student_id = s.Student_id;
          await AsyncStorage.setItem("session", JSON.stringify(session));
        } else {
          console.error("⚠️ Failed to fetch student info:", json.message);
          Alert.alert("Error", json.message || "Student info not found");
        }
      } catch (err) {
        console.error("❌ Error fetching student info:", err);
        Alert.alert("Error", "Failed to load student info");
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const availableYears = [...new Set(certifications.map((c) => c.year))];
  const filteredCerts = selectedYear
    ? certifications.filter((cert) => cert.year === selectedYear)
    : certifications;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.portfolioProfileContainer}>
        <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6, color: "#0249AD" }}>
          🪪 Student ID: {profile.student_id ?? "Not found"}
        </Text>

        {loadingProfile && <ActivityIndicator style={{ paddingVertical: 8 }} />}

        <View style={styles.profileRow}>
          <Image source={require("../assets/Diwata.jpg")} style={styles.profileImage} />
          <View style={styles.profileTextContainer}>
            <Text style={styles.portfolioName}>{profile.full_name || "Student Name"}</Text>
            <Text style={styles.portfolioSubtitle}>
              {profile.srcode ? `SR Code: ${profile.srcode}` : "SR Code: N/A"}
            </Text>
            <Text style={styles.portfolioSubtitle}>
              {profile.year ? `Year Level: ${profile.year}` : "Year Level: N/A"}
            </Text>
          </View>
        </View>

        <Text style={styles.portfolioBio}>
          Passionate student focused on building real-world projects. Exploring mobile and web development.
        </Text>

        <View style={{ width: "100%", marginTop: 30 }}>
          <Text style={styles.portfolioContactHeader}>Contact Info</Text>
          <Text style={styles.portfolioContactText}>📧 {profile.email || "No email"}</Text>
          <Text style={styles.portfolioContactText}>📞 {profile.contact || "No contact"}</Text>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.portfolioContactHeader}>Certifications</Text>
          <TouchableOpacity onPress={() => setShowFilterModal(true)}>
            <Icon name="filter-outline" size={22} color="#0249AD" />
          </TouchableOpacity>
        </View>

        <Modal visible={showFilterModal} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 20 }}>
            <View style={{ backgroundColor: "white", borderRadius: 10, padding: 20 }}>
              <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>Filter by Year</Text>
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  onPress={() => { setSelectedYear(year); setShowFilterModal(false); }}
                  style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#ddd" }}
                >
                  <Text>{year}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setSelectedYear(null); setShowFilterModal(false); }} style={{ marginTop: 10 }}>
                <Text style={{ color: "#0249AD", textAlign: "right" }}>Clear Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {filteredCerts.map((cert, index) => (
          <View key={index} style={styles.certCard}>
            <Image source={cert.logo} style={styles.certLogo} />
            <View style={styles.certInfo}>
              <Text style={styles.certTitle}>{cert.title}</Text>
              <Text style={styles.certOrg}>{cert.organization}</Text>
              <Text style={styles.certDate}>📅 {cert.date}</Text>
            </View>
          </View>
        ))}

        <View style={styles.sectionDivider} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.portfolioContactHeader}>Honors & Achievements</Text>
          <TouchableOpacity onPress={() => console.log("Filter honors")}>
            <Icon name="filter-outline" size={22} color="#0249AD" />
          </TouchableOpacity>
        </View>

        {honors.map((item, index) => (
          <View key={index} style={styles.honorCard}>
            <Text style={styles.honorTitle}>{item.title}</Text>
            <Text style={styles.honorDesc}>{item.description}</Text>
            <Text style={styles.honorDate}>📅 {item.date}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}