const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config(); // Add this to load environment variables

// Import routes - use require for all
const authRoutes = require("./routes/auth");
const formRoutes = require("./routes/forms");
const responseRoutes = require("./routes/responses");
const uploadRoutes = require("./routes/upload");
const visitRoutes = require("./routes/visits");
const bulkImportRouter = require("./routes/bulk-import");

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:3000" ||
      "https://form-builder-frontend-tawny.vercel.app/",
    credentials: true,
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Trust proxy for IP address
app.set("trust proxy", 1);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/visits", visitRoutes);
app.use("/api/bulk-import", bulkImportRouter);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Database connection
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://tonni-akter:tPewuNy5ZrM0yn4n@cluster0.qtpo1.mongodb.net/form_builder",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  )
  .then(() => {
    console.log("Connected to MongoDB");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection error:", error);
    process.exit(1);
  });

module.exports = app;
