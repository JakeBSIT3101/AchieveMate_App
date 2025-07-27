import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import styles from "../styles";

export default function ViewPortfolio() {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [badges, setBadges] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [fullscreenDetails, setFullscreenDetails] = useState({});
  const [selectedYear, setSelectedYear] = useState("");
  const [searchTitle, setSearchTitle] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId");
        if (!storedUserId) {
          console.warn("⚠️ No userId found in AsyncStorage.");
          return;
        }

        setUserId(storedUserId);

        const resUser = await fetch(`http://192.168.18.250:3000/user/${storedUserId}`);
        const dataUser = await resUser.json();
        if (resUser.ok) setUser(dataUser);

        const resCert = await fetch(`http://192.168.18.250:3000/certificates/${storedUserId}`);
        const dataCert = await resCert.json();
        if (resCert.ok) setCertificates(dataCert);

        const resBadges = await fetch(`http://192.168.18.250:3000/badges/${storedUserId}`);
        const dataBadges = await resBadges.json();
        if (resBadges.ok) setBadges(dataBadges);

        const resAchieve = await fetch(`http://192.168.18.250:3000/achievements/${storedUserId}`);
        const dataAchieve = await resAchieve.json();
        if (resAchieve.ok) setAchievements(dataAchieve);

      } catch (err) {
        console.error("❌ Error fetching data:", err.message);
      }
    };

    fetchData();
  }, []);

  const filteredCertificates = certificates.filter(cert =>
    (!selectedYear || cert.date_granted.includes(selectedYear)) &&
    (!searchTitle || cert.title.toLowerCase().includes(searchTitle.toLowerCase()))
  );

  // Combine achievements and badges only
  const honorsList = [
    ...achievements.map(a => ({
      type: "achievement",
      title: a.title,
      description: a.description,
    })),
    ...badges.map(b => ({
      type: "badge",
      title: b.badgetitle,
      image: b.badge,
    })),
  ];

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.portfolioProfileContainer}>
        {/* Profile Header */}
        <View style={styles.profileRow}>
          <Image source={require("../assets/Diwata.jpg")} style={styles.profileImage} />
          <View style={styles.profileTextContainer}>
            <Text style={styles.portfolioName}>
              {user ? `${user.firstname} ${user.middlename} ${user.lastname}` : "Loading..."}
            </Text>
            <Text style={styles.portfolioSubtitle}>
              {user?.program || "Program"} | {user?.track || "Track"}
            </Text>
            <Text style={styles.portfolioSubtitle}>Batch of {user?.Year || "Year"}</Text>
          </View>
        </View>

        <Text style={styles.portfolioBio}>
          Welcome to your student portfolio. Your personal, academic, and achievement details will appear here.
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

        {/* Filter Modal */}
        <Modal visible={showFilterModal} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 20 }}>
            <View style={{ backgroundColor: "white", borderRadius: 10, padding: 20 }}>
              <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>Filter Certificates</Text>
              <Text style={{ marginTop: 10 }}>Year:</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, marginBottom: 10 }}
                placeholder="e.g. 2024"
                keyboardType="numeric"
                value={selectedYear}
                onChangeText={setSelectedYear}
              />
              <Text>Title:</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8 }}
                placeholder="Search by title"
                value={searchTitle}
                onChangeText={setSearchTitle}
              />
              <TouchableOpacity onPress={() => setShowFilterModal(false)} style={{ marginTop: 15 }}>
                <Text style={{ color: "#0249AD", textAlign: "right" }}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Certifications Grid */}
        {filteredCertificates.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#aaa" }}>No certifications match your filters.</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
            {filteredCertificates.map(cert => (
              <TouchableOpacity
                key={cert.certi_id}
                onPress={() => {
                  setFullscreenImage(`data:image/jpeg;base64,${cert.certi}`);
                  setFullscreenDetails({ title: cert.title, date: cert.date_granted });
                }}
              >
                <Image
                  source={{ uri: `data:image/jpeg;base64,${cert.certi}` }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 8,
                    margin: 8,
                    borderWidth: 1,
                    borderColor: "#ccc",
                  }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Fullscreen Certificate Modal */}
        <Modal
          visible={!!fullscreenImage}
          transparent
          animationType="fade"
          onRequestClose={() => setFullscreenImage(null)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.9)",
              justifyContent: "center",
              alignItems: "center",
              padding: 16,
            }}
            onPress={() => setFullscreenImage(null)}
          >
            {fullscreenImage && (
              <>
                <Image
                  source={{ uri: fullscreenImage }}
                  style={{ width: "90%", height: "70%", resizeMode: "contain", marginBottom: 20 }}
                />
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
                  {fullscreenDetails.title}
                </Text>
                <Text style={{ color: "#ccc", fontSize: 14 }}>
                  Issued on: {fullscreenDetails.date}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Modal>

        <View style={styles.sectionDivider} />

        {/* Honors & Achievements */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.portfolioContactHeader}>Honors & Achievements</Text>
        </View>

        {honorsList.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#aaa" }}>
            No honors or achievements yet.
          </Text>
        ) : (
          <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
            {honorsList.map((item, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f0f0f0",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 14 }}>{item.title}</Text>
                  {item.description && (
                    <Text style={{ fontSize: 13, color: "#555" }}>{item.description}</Text>
                  )}
                </View>
                {item.image && (
                  <Image
                    source={{
                      uri: item.image.startsWith("http")
                        ? item.image
                        : `data:image/png;base64,${item.image}`,
                    }}
                    style={{ width: 40, height: 40 }}
                    resizeMode="contain"
                  />
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionDivider} />
      </View>
    </ScrollView>
  );
}
