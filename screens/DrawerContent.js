import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, LayoutAnimation, Platform, UIManager } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import styles from "../styles";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    title: "Application",
    icon: require("../assets/status.png"),
    isDropdown: true,
    children: [
      {
        title: "Dean's Honor",
        screen: "ApplicationforDeans",
      },
      {
        title: "Graduation",
        screen: "Application For Graduation",
      },
      {
        title: "Latin Honors",
        screen: "Application For Latin Honors",
      },
    ],
  },
  {
    title: "Application Status",
    icon: require("../assets/status.png"),
    screen: "Application Status",
  },
  {
    title: "Notifications",
    icon: require("../assets/latinhonor.png"),
    screen: "Notifications",
  },
];

const DrawerContent = ({ navigation }) => {
  const currentRoute =
    navigation.getState().routes[navigation.getState().index].name;
  const [applicationOpen, setApplicationOpen] = useState(true);

  const toggleApplication = () => {
    LayoutAnimation.easeInEaseOut();
    setApplicationOpen((prev) => !prev);
  };

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
          if (item.isDropdown) {
            return (
              <View key={index}>
                <TouchableOpacity
                  style={[
                    styles.drawerItemCard,
                    applicationOpen && { backgroundColor: "#e6f0ff" },
                  ]}
                  onPress={toggleApplication}
                >
                  <Image source={item.icon} style={styles.drawerIcon} />
                  <Text style={styles.drawerItemText}>{item.title}</Text>
                  <Ionicons
                    name={applicationOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#1d4ed8"
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>
                {applicationOpen &&
                  item.children.map((child) => {
                    const active = currentRoute === child.screen;
                    return (
                      <TouchableOpacity
                        key={child.screen}
                        style={[
                          styles.dropdownItem,
                          active && { backgroundColor: "#f0f7ff" },
                        ]}
                        onPress={() => navigation.navigate(child.screen)}
                      >
                        <View style={styles.dropdownTextWrapper}>
                          <Ionicons
                            name={
                              child.screen.includes("Deans")
                                ? "ribbon-outline"
                                : child.screen.includes("Graduation")
                                ? "school-outline"
                                : "star-outline"
                            }
                            size={16}
                            color="#2563eb"
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={[
                              styles.dropdownText,
                              active && { color: "#1d4ed8", fontWeight: "700" },
                            ]}
                          >
                            {child.title}
                          </Text>
                        </View>
                        {child.badge && (
                          <View
                            style={[
                              styles.dropdownBadge,
                              { backgroundColor: child.badgeColor || "#2563eb" },
                            ]}
                          >
                            <Text style={styles.dropdownBadgeText}>
                              {child.badge}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          }

          const isActive = currentRoute === item.screen;
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.drawerItemCard,
                isActive && { backgroundColor: "#e6f0ff" },
              ]}
              onPress={() => navigation.navigate(item.screen)}
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
