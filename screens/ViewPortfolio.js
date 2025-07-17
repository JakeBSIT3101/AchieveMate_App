import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import styles from "../styles";

const certifications = [
  {
    title: "Frontend Developer Certificate",
    organization: "Meta",
    date: "April 2024",
    year: "2024",
    logo: require("../assets/meta.png"),
  },
  {
    title: "AWS Cloud Practitioner",
    organization: "Amazon",
    date: "January 2024",
    year: "2024",
    logo: require("../assets/meta.png"),
  },
  {
    title: "React Native Course",
    organization: "Coursera",
    date: "March 2023",
    year: "2023",
    logo: require("../assets/meta.png"),
  },
];

const honors = [
  {
    title: "Dean’s Lister",
    description: "Recognized for academic excellence in 2023.",
    date: "December 2023",
  },
  {
    title: "Best Capstone Project",
    description: "Awarded for top-performing senior project.",
    date: "March 2024",
  },
];

export default function StudentProfile() {
  const [selectedYear, setSelectedYear] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const availableYears = [...new Set(certifications.map((c) => c.year))];

  const filteredCerts = selectedYear
    ? certifications.filter((cert) => cert.year === selectedYear)
    : certifications;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.portfolioProfileContainer}>
        {/* Profile Section */}
        <View style={styles.profileRow}>
          <Image
            source={require("../assets/Diwata.jpg")}
            style={styles.profileImage}
          />
          <View style={styles.profileTextContainer}>
            <Text style={styles.portfolioName}>John Kenneth Smith</Text>
            <Text style={styles.portfolioSubtitle}>
              Bachelor of Science in Computer Science
            </Text>
            <Text style={styles.portfolioSubtitle}>Batch of 2025</Text>
          </View>
        </View>

        <Text style={styles.portfolioBio}>
          Passionate software developer and student focused on mobile and web
          development. Skilled in React Native, AWS, and UI/UX design.
        </Text>

        {/* Contact Info */}
        <View style={{ width: "100%", marginTop: 30 }}>
          <Text style={styles.portfolioContactHeader}>Contact Info</Text>
          <Text style={styles.portfolioContactText}>
            📧 kenneth.smith@email.com
          </Text>
          <Text style={styles.portfolioContactText}>📞 +1 (234) 567-8900</Text>
        </View>

        {/* Divider */}
        <View style={styles.sectionDivider} />

        {/* Certifications Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.portfolioContactHeader}>Certifications</Text>
          <TouchableOpacity onPress={() => setShowFilterModal(true)}>
            <Icon name="filter-outline" size={22} color="#0249AD" />
          </TouchableOpacity>
        </View>

        {/* Filter Modal */}
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
              <Text
                style={{ fontWeight: "bold", fontSize: 16, marginBottom: 10 }}
              >
                Filter by Year
              </Text>
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  onPress={() => {
                    setSelectedYear(year);
                    setShowFilterModal(false);
                  }}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: "#ddd",
                  }}
                >
                  <Text>{year}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => {
                  setSelectedYear(null); // Clear filter
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

        {/* Filtered Certifications */}
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

        {/* Divider */}
        <View style={styles.sectionDivider} />

        {/* Honors Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.portfolioContactHeader}>
            Honors & Achievements
          </Text>
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
