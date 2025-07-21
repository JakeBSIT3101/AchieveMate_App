import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import styles from "../styles";

const ApplicationStatus = () => {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const userId = await AsyncStorage.getItem("userId");

        const res = await fetch(`http://192.168.18.250:3000/status/${userId}`);
        const data = await res.json();
        setStatusData(data);
      } catch (err) {
        console.error("❌ Error fetching status:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.staticContainer}>
      <Text style={styles.welcomeText}>Application Status</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#0249AD" />
      ) : (
        <>
          <View style={styles.honorCard}>
            <Text style={styles.honorTitle}>Dean's List</Text>
            <Text style={styles.honorDesc}>
              Status: {statusData?.deansListStatus || "Not Applied"}
            </Text>
            <Text style={styles.honorDate}>
              Last updated: {statusData?.deansListDate || "N/A"}
            </Text>
          </View>

          <View style={styles.honorCard}>
            <Text style={styles.honorTitle}>Latin Honor</Text>
            <Text style={styles.honorDesc}>
              Status: {statusData?.latinHonorStatus || "Not Applied"}
            </Text>
            <Text style={styles.honorDate}>
              Last updated: {statusData?.latinHonorDate || "N/A"}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

export default ApplicationStatus;
