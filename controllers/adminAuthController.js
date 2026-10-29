
import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import validator from "validator";
import jwt from "jsonwebtoken";

function createAdminToken(admin) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }

  return jwt.sign(
    { id: admin._id, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

// Admin Login
export async function loginAdmin(req, res) {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter email and password.",
      });
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      admin.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = createAdminToken(admin);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
}

// Admin Registration
export async function registerAdmin(req, res) {
  try {
    console.log("Admin registration content type:", req.headers["content-type"]);
    console.log("Admin registration body:", req.body);
    console.log("Admin registration received fields:", {
      hasName: Boolean(req.body?.name),
      hasEmail: Boolean(req.body?.email),
      hasPassword: Boolean(req.body?.password),
    });

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all fields.",
        received: {
          name: Boolean(name),
          email: Boolean(email),
          password: Boolean(password),
        },
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
    });

    console.log("Admin account created:", admin.email);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (err) {
    console.error("Admin registration error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
}
