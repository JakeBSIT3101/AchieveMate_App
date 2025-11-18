import React, { useEffect, useState, useRef, useCallback } from "react";
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

  const fadeIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const fetchAnnouncements = useCallback(async () => {
    try {
      console.log("📡 Fetching announcements from hosted database...");
      setLoading(true);
      const res = await fetch(`${BASE_URL}/post.php`); // ✅ use /api/post.php
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Ensure we always store an array for stable rendering
      const arr = Array.isArray(json) ? json : [];
      setAnnouncements(arr);
      fadeIn();
    } catch (err) {
      console.error("❌ Error fetching announcements:", err);
      Alert.alert("❌ Error", "Failed to fetch announcements.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [BASE_URL]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const handlePress = (item) => {
    console.log("Pressed:", item?.Title);
    const t = (item?.Title || "").toLowerCase();
    if (t.includes("dean") && t.includes("honor list")) {
      console.log("Navigating to ApplicationforDeans");
      navigation.navigate("ApplicationforDeans");
    }
  };

  const renderImage = (item) => {
    // Server now provides: item.image_url (e.g., https://.../post-image.php?id=123)
    const uri = item?.image_url || null;
    console.log("🖼️ image_url for", item?.Post_id, "→", uri);
    if (!uri) {
      return (
        <Image
          source={require("../assets/placeholder.png")}
          style={styles.announcementImage}
        />
      );
    }
    return (
      <Image
        source={{ uri }}
        style={styles.announcementImage}
        onError={() => console.warn("Image failed:", item?.Post_id)}
        // defaultSource works on iOS only; harmless on Android
        defaultSource={require("../assets/placeholder.png")}
      />
    );
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
          style={[styles.announcementsContainer, { opacity: fadeAnim }]}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#DC143C" />
          ) : announcements.length === 0 ? (
            <Text>No announcements available.</Text>
          ) : (
            announcements.map((item, index) => (
              <TouchableOpacity
                key={item?.Post_id ?? index}
                style={styles.announcementCard}
                onPress={() => handlePress(item)}
                activeOpacity={0.8}
              >
                {renderImage(item)}
                <Text style={styles.announcementTitle}>{item?.Title}</Text>
                <Text style={styles.announcementDate}>
                  {item?.Start_date} to {item?.End_date}
                </Text>
                <Text style={styles.announcementDescription}>
                  {item?.Announcement}
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
