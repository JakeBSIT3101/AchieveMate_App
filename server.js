const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Change this if your MySQL has a password
  database: 'achievebase',
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ Error connecting to MySQL:', err.message);
  } else {
    console.log('✅ Connected to MySQL');
  }
});

// Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Login query error:', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (results.length > 0) {
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });
});

// Announcement route (for frontend fetch)
app.get('/announcement', (req, res) => {
  const query = `
    SELECT 
      id, 
      title, 
      date, 
      description, 
      TO_BASE64(image) AS image
    FROM announcement
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching announcements:', err.message);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(results);
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://192.168.250.76:${port}`);
});
