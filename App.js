import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createStackNavigator } from "@react-navigation/stack";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ViewPortfolio from "./screens/ViewPortfolio"; 
import DeanList from "./screens/DeanList";
import DrawerContent from "./screens/DrawerContent";
import ApplicationStatus from "./screens/ApplicationStatus";

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// ✅ Drawer navigator with both Home and ViewPortfolio
const DrawerNavigator = () => (
  <Drawer.Navigator
    initialRouteName="Home"
    drawerContent={(props) => <DrawerContent {...props} />}
    screenOptions={{ headerShown: true }}
  >
    <Drawer.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: "" }} // This hides the "Home" title in the top bar
    />
    <Drawer.Screen name="ViewPortfolio" component={ViewPortfolio} />
    <Drawer.Screen name="DeanList" component={DeanList} />
    <Drawer.Screen name="ApplicationStatus" component={ApplicationStatus} />
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
