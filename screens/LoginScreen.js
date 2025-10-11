import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  Image,
  Modal,
  ImageBackground,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import CheckBox from "expo-checkbox";
import styles from "../styles";
import { BASE_URL } from "../config/api";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing Input", "Please enter both username and password.");
      return;
    }

    setLoading(true);

    try {
      // Step 1️⃣: Login request
      const loginResponse = await fetch(`${BASE_URL}/login.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const loginText = await loginResponse.text();
      console.log("📥 Raw login response:", loginText);

      let loginResult;
      try {
        loginResult = JSON.parse(loginText);
      } catch {
        console.error("❌ Invalid JSON from login.php!");
        Alert.alert("Error", "Server returned invalid login response.");
        setLoading(false);
        return;
      }

      if (!loginResult.success) {
        setLoading(false);
        Alert.alert("❌ Login Failed", loginResult.message || "Invalid credentials");
        return;
      }

      console.log("✅ Login success:", loginResult);

      const login_id = loginResult.login_id;

      // Step 2️⃣: Fetch student_id using getuser.php
      const userResponse = await fetch(`${BASE_URL}/getuser.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id }),
      });

      const userText = await userResponse.text();
      console.log("📥 Raw getuser.php response:", userText);

      let userResult;
      try {
        userResult = JSON.parse(userText);
      } catch {
        console.error("❌ Invalid JSON from getuser.php!");
        Alert.alert("Error", "Server returned invalid student data.");
        setLoading(false);
        return;
      }

      if (!userResult.success || !userResult.student_id) {
        setLoading(false);
        Alert.alert("Error", "Missing student ID from server.");
        return;
      }

      console.log("✅ Retrieved student_id:", userResult.student_id);

      // Step 3️⃣: Save session
      const sessionData = {
        username,
        password,
        login_id,
        student_id: userResult.student_id,
        usertype: loginResult.usertype,
      };

      await AsyncStorage.setItem("session", JSON.stringify(sessionData));
      console.log("💾 Saved session:", sessionData);

      setTimeout(() => {
        setLoading(false);
        navigation.replace("DrawerNavigator", { profile: sessionData });
      }, 1000);
    } catch (error) {
      setLoading(false);
      console.error("Login error:", error.message);
      Alert.alert("❌ Error", "Something went wrong while logging in.");
    }
  };

  const handleForgotPassword = () => {
    Alert.alert("Forgot Password", "Redirect to password recovery (not implemented).");
  };

  return (
    <ImageBackground
      source={require("../assets/login_bg2.png")}
      style={{ flex: 1 }}
      imageStyle={{ opacity: 0.5 }}
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

        {loading && (
          <Modal transparent animationType="fade">
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.4)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <LottieView
                source={require("../assets/loading_medal.json")}
                autoPlay
                loop
                style={{ width: 150, height: 150 }}
              />
            </View>
          </Modal>
        )}
      </View>
    </ImageBackground>
  );
};

export default LoginScreen;