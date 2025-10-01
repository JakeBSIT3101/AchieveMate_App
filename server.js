const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs"); // Import bcrypt for password hashing
const session = require("express-session"); // Import session for session management
const cors = require("cors"); // Enable CORS for cross-origin requests
require("dotenv").config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: "your-secret-key", // Replace with secure key in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "u780655614_achievemate",
  password: process.env.DB_PASS || "Jaztintampis@18",
  database: process.env.DB_NAME || "u780655614_achievemate",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("❌ Error connecting to MySQL:", err.message);
  } else {
    console.log("✅ Connected to MySQL");
  }
});

// Login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const query = "SELECT * FROM login WHERE username = ?";
  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error("❌ Login query error:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (results.length === 0) {
      console.log(`❌ Invalid username: ${username}`);
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const user = results[0];

    // 🔒 Reject if not a Student before checking the password
    if (user.usertype !== "Student") {
      console.log(
        `❌ Unauthorized access attempt: ${username} is a ${user.usertype}`
      );
      return res.status(403).json({
        success: false,
        message: "Access denied: Only students are allowed.",
      });
    }

    try {
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        console.log(`❌ Invalid password for username: ${username}`);
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      // ✅ Store session and return user info
      req.session.user = {
        username: user.username,
        usertype: user.usertype,
        login_id: user.Login_id,
      };

      res.json({
        success: true,
        usertype: user.usertype,
        login_id: user.Login_id,
      });
    } catch (err) {
      console.error("❌ Error during password verification:", err.message);
      return res.status(500).json({
        success: false,
        message: "Server error during password check",
      });
    }
  });
});

// Logout route to clear session
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Logout failed:", err.message);
      return res.status(500).json({ message: "Logout failed" });
    }
    console.log("✅ User logged out successfully");
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// Fetch posts
app.get("/post", (req, res) => {
  const query = `
    SELECT 
      Post_id, 
      Title, 
      Announcement, 
      Start_date,
      End_date,
      TO_BASE64(image) AS image
    FROM post
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching announcements:", err.message);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
