const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs"); // Import bcrypt for password hashing
const session = require("express-session"); // Import session for session management
const cors = require("cors"); // Enable CORS for cross-origin requests
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: "your-secret-key", // You can replace this with a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using https
  })
);

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // Change if you have a password
  database: "achievemate",
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

    try {
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        console.log(`❌ Invalid password for username: ${username}`);
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      // Reject if not a student
      if (user.usertype !== "Student") {
        console.log(
          `❌ Unauthorized access: ${username} is a ${user.usertype}`
        );
        return res
          .status(403)
          .json({
            success: false,
            message: "This system is only for student users.",
          });
      }

      // Store session
      req.session.user = {
        username: user.username,
        usertype: user.usertype,
        login_id: user.Login_id,
      };

      // Return data silently (no message)
      res.json({
        success: true,
        usertype: user.usertype,
        login_id: user.Login_id,
      });
    } catch (err) {
      console.error("❌ Error during password comparison:", err.message);
      return res
        .status(500)
        .json({
          success: false,
          message: "Server error during password verification",
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
