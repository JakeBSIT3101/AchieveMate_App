import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import CheckBox from 'expo-checkbox';
import styles from '../styles';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Input', 'Please enter both email and password.');
      return;
    }

    try {
      const response = await fetch('http://192.168.250.76:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok) {
        navigation.replace('DrawerNavigator');
      } else {
        Alert.alert('❌ Login Failed', result.message || 'Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error.message);
      Alert.alert('❌ Error', error.message || 'Something went wrong while logging in');
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Redirect to password recovery screen (not implemented)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image source={require('../assets/image.png')} style={styles.logo} />

        <TextInput
          style={[styles.input, styles.blueField]}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
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
            <Icon name={isPasswordVisible ? 'eye-off' : 'eye'} size={24} color="#0249AD" />
          </TouchableOpacity>
        </View>

        <View style={styles.rememberForgotRow}>
          <View style={styles.rememberMe}>
            <CheckBox
              value={rememberMe}
              onValueChange={setRememberMe}
              color={rememberMe ? '#0249AD' : undefined}
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
    </View>
  );
};

export default LoginScreen;
