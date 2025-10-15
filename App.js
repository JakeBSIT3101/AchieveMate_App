import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createStackNavigator } from "@react-navigation/stack";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ViewPortfolio from "./screens/ViewPortfolio";
import DrawerContent from "./screens/DrawerContent";
import ApplicationforDeans from "./screens/ApplicationforDeans";
import ApplicationForGraduation from "./screens/ApplicationForGraduation";
import ApplicationStatus from "./screens/ApplicationStatus";
import ApplicationForLatinHonors from "./screens/ApplicationForLatinHonors";

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// ✅ Drawer navigator with both Home and ViewPortfolio
const DrawerNavigator = () => (
  <Drawer.Navigator
    initialRouteName="Home"
    drawerContent={(props) => <DrawerContent {...props} />}
    screenOptions={{ headerShown: true }}
  >
    <Drawer.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
    <Drawer.Screen name="ViewPortfolio" component={ViewPortfolio} />
    <Drawer.Screen name="Application For Graduation" component={ApplicationForGraduation} />
    <Drawer.Screen name="Application Status" component={ApplicationStatus} />
    <Drawer.Screen name="Application For Latin Honors" component={ApplicationForLatinHonors} />
    <Drawer.Screen
      name="ApplicationforDeans"
      component={ApplicationforDeans}
      options={{ title: "Application For Dean's List" }}
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
