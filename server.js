const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const cors = require("cors");
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "achievemate",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error connecting to MySQL:", err.message);
  } else {
    console.log("✅ Connected to MySQL");
  }
});

// 🔐 LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const query = "SELECT * FROM login WHERE username = ?";
  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error("❌ Login query error:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = results[0];

    if (user.usertype !== "Student") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only students are allowed.",
      });
    }

    try {
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      // Fetch userId from studentmanagement
      const lookupQuery = "SELECT userId FROM studentmanagement WHERE Login_id = ?";
      db.query(lookupQuery, [user.Login_id], (lookupErr, lookupRes) => {
        if (lookupErr) {
          console.error("❌ Error fetching userId:", lookupErr.message);
          return res.status(500).json({ message: "Database lookup error" });
        }

        if (lookupRes.length === 0) {
          console.warn(`⚠️ No student record found for Login_id: ${user.Login_id}`);
          return res.status(404).json({ message: "Student profile not found" });
        }

        const userId = lookupRes[0].userId;
        console.log("✅ Login successful. Returning userId:", userId);

        // Store session
        req.session.user = {
          username: user.username,
          usertype: user.usertype,
          login_id: user.Login_id,
          userId: userId,
        };

        return res.json({
          success: true,
          usertype: user.usertype,
          login_id: user.Login_id,
          userId: userId,
        });
      });
    } catch (err) {
      console.error("❌ Password verification error:", err.message);
      return res.status(500).json({ message: "Server error during password check" });
    }
  });
});

// 🚪 LOGOUT
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

// 📢 POSTS
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
      console.error("❌ Error fetching announcements:", err.message);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

// 👤 STUDENT PROFILE BY userId
app.get("/user/:userId", (req, res) => {
  const userId = req.params.userId;

  const query = "SELECT * FROM studentmanagement WHERE userId = ?";
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching user details:", err.message);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(results[0]);
  });
});

// 📜 Fetch certificates by userId
app.get("/certificates/:userId", (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT certi_id, title, date_granted, TO_BASE64(certi) AS certi
    FROM certificate
    WHERE userId = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching certificates:", err.message);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

// 🏅 Fetch badges by userId
app.get("/badges/:userId", (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT badge_id, badgetitle, badgetype, TO_BASE64(badge) AS badge
    FROM badges
    WHERE userId = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching badges:", err.message);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

// Combined Honors & Certificates Titles
app.get("/achievements/:userId", (req, res) => {
  const { userId } = req.params;

  const honorQuery = `
    SELECT title, description 
    FROM honors 
    WHERE userId = ?
  `;

  const honorsList = [
      ...achievements.map(a => ({ type: "achievement", title: a.title, description: a.description })),
      ...badges.map(b => ({ type: "badge", title: b.badgetitle, image: b.badge })),
    ];
    
  db.query(honorQuery, [userId], (honorErr, honorResults) => {
    if (honorErr) {
      console.error("❌ Error fetching honors:", honorErr.message);
      return res.status(500).json({ message: "Database error (honors)" });
    }
  });
});



// 🚀 Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
