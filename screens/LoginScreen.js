import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  ImageBackground, // Import ImageBackground for background image
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import CheckBox from "expo-checkbox";
import styles from "../styles";
import { BASE_URL } from "../config/api";

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false); // NEW

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing Input", "Please enter both username and password.");
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setLoading(true); //loading screen

        // Wait for 2 seconds before navigating
        setTimeout(() => {
          setLoading(false);
          navigation.replace("DrawerNavigator");
        }, 1500);
      } else {
        Alert.alert(
          "❌ Login Failed",
          result.message || "Invalid username or password"
        );
      }
    } catch (error) {
      console.error("Login error:", error.message);
      Alert.alert(
        "❌ Error",
        error.message || "Something went wrong while logging in"
      );
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Forgot Password",
      "Redirect to password recovery screen (not implemented)"
    );
  };

  return (
    <ImageBackground
      source={require("../assets/login_bg2.png")}
      style={{ flex: 1 }}
      imageStyle={{ opacity: 0.5 }} // Apply opacity to the background image
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 20,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 8,
            elevation: 6,
            alignItems: "center",
          }}
        >
          <Image source={require("../assets/image.png")} style={styles.logo} />

          <TextInput
            style={[styles.input, styles.blueField]}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <View style={styles.passwordInputContainer}>
            <TextInput
              style={[styles.input, styles.blueField]}
              placeholder="Password"
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            >
              <Icon
                name={isPasswordVisible ? "eye-off" : "eye"}
                size={24}
                color="#0249AD"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.rememberForgotRow}>
            <View style={styles.rememberMe}>
              <CheckBox
                value={rememberMe}
                onValueChange={setRememberMe}
                color={rememberMe ? "#0249AD" : undefined}
              />
              <Text style={styles.rememberMeText}>Remember me</Text>
            </View>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.blueButton} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        </View>

        {/* Loading Overlay */}
        {loading && (
          <Modal transparent={true} animationType="fade">
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.4)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  backgroundColor: "#fff",
                  padding: 20,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color="#0249AD" />
                <Text style={{ marginTop: 10, fontSize: 16, color: "#0249AD" }}>
                  Logging in...
                </Text>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </ImageBackground>
  );
};

export default LoginScreen;
