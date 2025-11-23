import React from "react";
import { View, Text } from "react-native";
import styles from "../styles";

const ApplicationStatus = () => {
  return (
    <View style={[styles.container1, { flex: 1, alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ fontSize: 18, color: "#0249AD", fontWeight: "600" }}>
        Application Status
      </Text>
      <Text style={{ marginTop: 8, color: "#555" }}>
        Status tracking will appear here soon.
      </Text>
    </View>
  );
};

export default ApplicationStatus;
