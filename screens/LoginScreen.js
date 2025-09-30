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
      const response = await fetch(`${BASE_URL}/login.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      // 👀 Debug raw response
      const textResponse = await response.text();
      console.log("📥 Raw server response:", textResponse);

      // Try parsing JSON safely
      let result;
      try {
        result = JSON.parse(textResponse);
      } catch (e) {
        console.error("❌ Response is not valid JSON!");
        Alert.alert("❌ Error", "Server did not return JSON.");
        setLoading(false);
        return;
      }

      if (response.ok && result.success) {
        setTimeout(() => {
          setLoading(false);
          navigation.replace("DrawerNavigator");
        }, 1500);
      } else {
        setLoading(false);
        Alert.alert(
          "❌ Login Failed",
          result.message || "Invalid username or password"
        );
      }
    } catch (error) {
      setLoading(false);
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

        {/* Loading Modal with GIF */}
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
