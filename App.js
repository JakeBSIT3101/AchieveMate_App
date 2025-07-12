import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import DrawerContent from './screens/DrawerContent';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const DrawerNavigator = () => (
  <Drawer.Navigator drawerContent={(props) => <DrawerContent {...props} />}>
    <Drawer.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: '' }} // ✅ This hides the "Home" title in the top bar
    />
  </Drawer.Navigator>
);

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="DrawerNavigator" component={DrawerNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
