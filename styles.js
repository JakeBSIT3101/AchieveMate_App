import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f4f4f4",
    alignItems: "center",
    marginTop: 200,
  },
  card: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: 60,
    resizeMode: "contain",
    marginBottom: 20,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    width: "100%",
  },
  blueField: {
    borderColor: "#0249AD",
  },
  blueButton: {
    backgroundColor: "#0249AD",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  passwordInputContainer: {
    width: "100%",
    position: "relative",
  },
  eyeIcon: {
    position: "absolute",
    right: 10,
    top: 12,
  },
  rememberForgotRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  rememberMe: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberMeText: {
    marginLeft: 8,
    color: "#333",
  },
  forgotText: {
    color: "#0249AD",
    textDecorationLine: "underline",
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0249AD",
    marginBottom: 20,
  },
  infoText: {
    fontSize: 18,
    color: "#666",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    elevation: 4,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 15,
    color: "#0249AD",
  },
  subNavbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#e6f0ff",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  navItem: {
    alignItems: "center",
  },
  navText: {
    fontSize: 12,
    color: "#0249AD",
    marginTop: 4,
  },

  // Drawer styles
  drawerWrapper: {
    flex: 1,
    padding: 15,
    justifyContent: "space-between",
  },
  drawerHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  drawerLogo: {
    width: 150,
    height: 150,
    resizeMode: "contain",
    borderRadius: 50,
    marginBottom: -20,
  },
  drawerCard: {
    gap: 12,
  },
  drawerItemCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  drawerIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    resizeMode: "contain",
  },
  drawerItemText: {
    fontSize: 16,
    color: "black",
  },
  drawerLogoutContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  drawerLogoutButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  drawerLogoutText: {
    color: "#0249AD",
    fontSize: 16,
  },
  drawerLogoutContainer: {
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 20,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: "grey",
    marginVertical: 10,
    width: "100%",
  },
  homeHeader: {
    marginTop: 20, // ← controls distance from top
    marginBottom: 12, // ← small gap before the cards
    alignItems: "center",
    width: "100%",
  },
  homeHeaderText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0249AD",
    marginBottom: 12,
  },
  announcementCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },

  announcementImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },

  announcementTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0249AD",
    marginBottom: 4,
  },

  announcementDate: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
  },

  announcementDescription: {
    fontSize: 14,
    color: "#333",
  },
  announcementsContainer: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 20,
  },
  announcementSection: {
    marginTop: 100, // adjust this to move only announcements down
    width: "100%",
    alignItems: "center",
  },
  staticContainer: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f4f4f4",
    paddingTop: 40, // adjust as needed
  },
  activeDrawerItemCard: {
    backgroundColor: "#dbe9ff",
  },
  activeDrawerItemText: {
    color: "#0249AD",
    fontWeight: "bold",
  },
  // Portfolio styles
  portfolioProfileContainer: {
    marginVertical: 30,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    width: "90%",
    alignSelf: "center",
    display: "grid",
  },

  portfolioName: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#0249AD",
    marginTop: 10,
    paddingHorizontal: 2,
  },

  portfolioSubtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 6,
  },

  portfolioBio: {
    fontSize: 16,
    color: "#444",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
    paddingHorizontal: 10,
  },

  portfolioContactHeader: {
    fontWeight: "600",
    color: "#0249AD",
    fontSize: 18,
    marginTop: 30,
    marginBottom: 10,
    alignSelf: "flex-start",
  },

  portfolioContactText: {
    color: "#666",
    fontSize: 16,
    marginVertical: 2,
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  profileImage: {
    width: 130,
    height: 130,
    borderRadius: 50,
    resizeMode: "cover",
    marginRight: 20,
  },

  profileTextContainer: {
    flex: 1,
  },

  certCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
    alignItems: "center",
  },

  certLogo: {
    width: 40,
    height: 40,
    resizeMode: "contain",
    marginRight: 15,
  },

  certInfo: {
    flex: 1,
  },

  certTitle: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#0249AD",
  },

  certOrg: {
    color: "#666",
    marginTop: 2,
  },

  certDate: {
    color: "#999",
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#ccc",
    marginTop: 30,
    width: "100%",
  },

  honorCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },

  honorTitle: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#0249AD",
  },

  honorDesc: {
    marginTop: 6,
    fontSize: 14,
    color: "#555",
  },

  honorDate: {
    marginTop: 6,
    fontSize: 13,
    color: "#999",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 30,
    marginBottom: 10,
    paddingHorizontal: 5,
  },

    uploadContainer: {
    marginBottom: 25,
  },

  uploadLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
  },

  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0249AD",
    padding: 12,
    borderRadius: 8,
  },

  uploadButtonText: {
    color: "#fff",
    marginLeft: 8,
    fontWeight: "bold",
  },

  fileNameText: {
    marginTop: 6,
    fontStyle: "italic",
    color: "#666",
    fontSize: 13,
  },
});
