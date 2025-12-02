// backend/index.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

// Import routes
const users = require("./routes/user.js");
const books = require("./routes/books.js");
const admin = require("./routes/admin.js");
const librarian = require("./routes/librarian.js");
const home = require("./routes/home.js");

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "https://library-management-app-karan.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// API Routes
app.use("/users", users);
app.use("/books", books);
app.use("/admin", admin);
app.use("/librarian", librarian);
app.use("/home", home);

// Default route
app.get("/", (req, res) => {
  res.send("✅ Library Management API is running...");
});

// Database connection + server start
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

(async () => {
  try {
    // Mask credentials in console for security
    console.log(
      "Connecting to MongoDB:",
      uri?.replace(/\/\/.*?:.*?@/, "//<user>:<pass>@")
    );

    // ✅ Force database name in case the URI lacks it
    await mongoose.connect(uri, {
      dbName: process.env.DB_NAME || "library",
    });

    // Log the database name after connection
    console.log("✅ Connected DB name:", mongoose.connection.db.databaseName);

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Mongo connection error:", err.message);
    process.exit(1);
  }
})();
