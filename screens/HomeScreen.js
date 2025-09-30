import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
} from "react-native";
import styles from "../styles";
import { BASE_URL } from "../config/api";
import { TouchableOpacity } from "react-native";

const HomeScreen = ({ navigation }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchAnnouncements = () => {
    console.log("📡 Fetching announcements from hosted database...");

    fetch(`${BASE_URL}/post.php`) // 👈 Updated for PHP backend
      .then((res) => res.json())
      .then((data) => {
        setAnnouncements(data);
        setLoading(false);
        setRefreshing(false);
        fadeIn();

        // ✅ Notify only if data exists
      })
      .catch((error) => {
        console.error("❌ Error fetching announcements:", error);
        setLoading(false);
        setRefreshing(false);
        Alert.alert("❌ Error", "Failed to fetch announcements.");
      });
  };

  const fadeIn = () => {
    fadeAnim.setValue(0); // reset
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      scrollEventThrottle={16}
    >
      <View style={styles.staticContainer}>
        {/* Header */}
        <View style={styles.homeHeader}>
          <Text style={styles.homeHeaderText}>What's New</Text>
        </View>

        {/* Announcements */}
        <Animated.View
          style={[
            styles.announcementsContainer,
            { opacity: fadeAnim }, // fade animation
          ]}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#0249AD" />
          ) : announcements.length === 0 ? (
            <Text>No announcements available.</Text>
          ) : (
            announcements.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.announcementCard}
                onPress={() => {
                  if (
                    item.Title.toLowerCase().includes("dean's list") ||
                    item.Title.toLowerCase().includes("deans list")
                  ) {
                    navigation.navigate("ApplicationforDeans");
                  }
                }}
              >
                {item.image ? (
                  <Image
                    source={{ uri: `data:image/jpg;base64,${item.image}` }}
                    style={styles.announcementImage}
                  />
                ) : (
                  <Image
                    source={require("../assets/placeholder.png")}
                    style={styles.announcementImage}
                  />
                )}
                <Text style={styles.announcementTitle}>{item.Title}</Text>
                <Text style={styles.announcementDate}>
                  {item.Start_date} to {item.End_date}
                </Text>
                <Text style={styles.announcementDescription}>
                  {item.Announcement}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
      </View>
    </ScrollView>
  );
};

export default HomeScreen;
