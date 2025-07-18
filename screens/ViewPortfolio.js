import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import styles from "../styles";

export default function StudentProfile() {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId");

        if (!storedUserId) {
          console.warn("⚠️ No userId found in AsyncStorage.");
          return;
        }

        setUserId(storedUserId);

        const response = await fetch(`http://192.168.18.250:3000/user/${storedUserId}`);
        const data = await response.json();

        if (response.ok) {
          console.log("✅ User data fetched:", data);
          setUser(data);
        } else {
          console.warn("⚠️ Failed to fetch user profile");
        }
      } catch (err) {
        console.error("❌ Error fetching user profile:", err.message);
      }
    };

    fetchUserDetails();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.portfolioProfileContainer}>
        {/* Profile Header */}
        <View style={styles.profileRow}>
          <Image
            source={require("../assets/Diwata.jpg")}
            style={styles.profileImage}
          />
          <View style={styles.profileTextContainer}>
            <Text style={styles.portfolioName}>
              {user
                ? `${user.firstname} ${user.middlename} ${user.lastname}`
                : "Loading..."}
            </Text>
            <Text style={styles.portfolioSubtitle}>
              {user?.program || "Program"} | {user?.track || "Track"}
            </Text>
            <Text style={styles.portfolioSubtitle}>
              Batch of {user?.Year || "Year"}
            </Text>
          </View>
        </View>

        {/* Bio */}
        <Text style={styles.portfolioBio}>
          Welcome to your student portfolio. Your personal, academic, and achievement details will appear here.
        </Text>

        {/* Show User ID */}
        <Text style={{
          marginTop: 10,
          fontSize: 14,
          color: "#999",
          fontStyle: "italic",
          textAlign: "center",
        }}>
          User ID: {userId ?? "Loading..."}
        </Text>

        {/* Contact Info */}
        <View style={{ width: "100%", marginTop: 30 }}>
          <Text style={styles.portfolioContactHeader}>Contact Info</Text>
          <Text style={styles.portfolioContactText}>📧 {user?.email || "N/A"}</Text>
          <Text style={styles.portfolioContactText}>📞 {user?.contact || "N/A"}</Text>
        </View>

        <View style={styles.sectionDivider} />

        {/* Certifications */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.portfolioContactHeader}>Certifications</Text>
          <TouchableOpacity onPress={() => setShowFilterModal(true)}>
            <Icon name="filter-outline" size={22} color="#0249AD" />
          </TouchableOpacity>
        </View>

        <Modal visible={showFilterModal} transparent animationType="slide">
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.5)",
              padding: 20,
            }}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 10,
                padding: 20,
              }}
            >
              <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>
                Filter by Year
              </Text>

              {/* Filter Option */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedYear(null);
                  setShowFilterModal(false);
                }}
                style={{ marginTop: 10 }}
              >
                <Text style={{ color: "#0249AD", textAlign: "right" }}>
                  Clear Filter
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.sectionDivider} />

        {/* Honors Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.portfolioContactHeader}>Honors & Achievements</Text>
        </View>

        <Text style={{ textAlign: "center", color: "#aaa" }}>
          No honors data yet.
        </Text>
      </View>
    </ScrollView>
  );
}