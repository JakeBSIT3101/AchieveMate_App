import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { useRoute, useNavigation } from "@react-navigation/native";
import styles from "../styles";

const menuItems = [
  { title: "Home", icon: require("../assets/home.png"), screen: "Home" },
  {
    title: "View Portfolio",
    icon: require("../assets/portfolio.png"),
    screen: "ViewPortfolio",
  },
  {
    title: "Upload Grades",
    icon: require("../assets/status.png"),
    screen: "Upload Grades",
  },
  {
    title: "Apply Dean's List",
    icon: require("../assets/deanslist.png"),
    screen: "ApplicationforDeans",
  },
  {
    title: "Apply Latin Honor",
    icon: require("../assets/latinhonor.png"),
    screen: "Application For Latin Honors",
  },
  {
    title: "Application for Graduation",
    icon: require("../assets/latinhonor.png"),
    screen: "Application For Graduation",
  },
  {
    title: "Application Status",
    icon: require("../assets/status.png"),
    screen: "Application Status",
  },
];

const DrawerContent = ({ navigation }) => {
  const currentRoute =
    navigation.getState().routes[navigation.getState().index].name;

  return (
    <View style={styles.drawerWrapper}>
      {/* Top Logo */}
      <View style={styles.drawerHeader}>
        <Image
          source={require("../assets/image.png")}
          style={styles.drawerLogo}
        />
        <View style={styles.drawerDivider} />
      </View>

      {/* Menu Items */}
      <View style={styles.drawerCard}>
        {menuItems.map((item, index) => {
          const isActive = currentRoute === item.screen;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.drawerItemCard,
                isActive && { backgroundColor: "#e6f0ff" }, // Highlight active
              ]}
              onPress={() => {
                navigation.navigate(item.screen);
              }}
            >
              <Image source={item.icon} style={styles.drawerIcon} />
              <Text
                style={[
                  styles.drawerItemText,
                  isActive && { color: "#DC143C", fontWeight: "bold" },
                ]}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Logout Button */}
      <View style={styles.drawerLogoutContainer}>
        <TouchableOpacity
          onPress={() => navigation.replace("Login")}
          style={styles.drawerLogoutButton}
        >
          <Icon
            name="log-out"
            size={18}
            color="#DC143C"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.drawerLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default DrawerContent;
