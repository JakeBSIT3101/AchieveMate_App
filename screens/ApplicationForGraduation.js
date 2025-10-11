// screens/ApplicationForGraduation.js
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function ApplicationForGraduation() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Application For Graduation</Text>
      <View style={styles.card}>
        <Text style={styles.label}>This is a smoke-tested screen.</Text>
        <Text>Replace with your real form after it renders cleanly.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  card: { padding: 16, borderWidth: 1, borderColor: "#ddd", borderRadius: 12 }
});
