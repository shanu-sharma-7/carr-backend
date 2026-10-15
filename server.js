
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

import { connectDB } from "./config/db.js";
import { uploadsDir } from "./middlewares/uploads.js";

import userRouter from "./routes/userRoutes.js";
import carRouter from "./routes/carRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import contactRouter from "./routes/contactRoutes.js";
import adminAuthRouter from "./routes/adminAuthRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images from the same directory used by Multer
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(uploadsDir)
);

// API routes
app.use("/api/auth", userRouter);
app.use("/api/cars", carRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/admin-auth", adminAuthRouter);
app.use("/api/contacts", contactRouter);

// Health check
app.get("/api/ping", (req, res) => {
  res.json({
    ok: true,
    time: Date.now(),
  });
});

// Root route
app.get("/", (req, res) => {
  res.send("API working");
});

// Error handler
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    message: err.message || "Server Error",
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
