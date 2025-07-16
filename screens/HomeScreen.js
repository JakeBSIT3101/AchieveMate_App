import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, ActivityIndicator } from "react-native";
import styles from "../styles";

const HomeScreen = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://192.168.254.102:3000/post") // Updated endpoint
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched announcements:", data);
        setAnnouncements(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching announcements:", error);
        setLoading(false);
      });
  }, []);

  return (
    <ScrollView>
      <View style={styles.staticContainer}>
        {/* Header */}
        <View style={styles.homeHeader}>
          <Text style={styles.homeHeaderText}>What's New</Text>
        </View>

        {/* Announcements */}
        <View style={styles.announcementsContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#0249AD" />
          ) : announcements.length === 0 ? (
            <Text>No announcements available.</Text>
          ) : (
            announcements.map((item, index) => (
              <View key={index} style={styles.announcementCard}>
                {item.image ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${item.image}` }}
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
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default HomeScreen;
