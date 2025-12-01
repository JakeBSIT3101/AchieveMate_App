import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createStackNavigator } from "@react-navigation/stack";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ViewPortfolio from "./screens/ViewPortfolio";
import DrawerContent from "./screens/DrawerContent";
import ApplicationforDeans from "./screens/ApplicationforDeans";
import ApplicationStatus from "./screens/ApplicationStatus";
import Notification from "./screens/Notification"; // We'll create this file next

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const headerRight = (navigation) => (
  <View style={{ marginRight: 15 }}>
    <TouchableOpacity
      onPress={() => navigation.navigate('Notification')}
    >
      <Ionicons name="notifications-outline" size={24} color="#000" />
    </TouchableOpacity>
  </View>
);
// ✅ Drawer navigator with both Home and ViewPortfolio
const DrawerNavigator = () => (
  <Drawer.Navigator
    initialRouteName="Home"
    drawerContent={(props) => <DrawerContent {...props} />}
    screenOptions={({ navigation }) => ({ 
      headerShown: true,
      headerRight: () => headerRight(navigation),
      headerTitle: ''
    })}
  >
    <Drawer.Screen name="Home" component={HomeScreen} options={{ title: "" }} />
    <Drawer.Screen name="ViewPortfolio" component={ViewPortfolio} />
    <Drawer.Screen
      name="ApplicationforDeans"
      component={ApplicationforDeans}
      options={{ title: "" }}
    />
    <Drawer.Screen
      name="ApplicationStatus"
      component={ApplicationStatus}
      options={{ title: "" }}
    />
    <Drawer.Screen 
      name="Notification" 
      component={Notification} 
      options={{ title: "Notifications" }}
    />
  </Drawer.Navigator>
);

// ✅ Main navigation container
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="Login"
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="DrawerNavigator" component={DrawerNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
