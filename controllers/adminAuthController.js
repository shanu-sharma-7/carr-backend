import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import Admin from "../models/Admin.js";

const createAdminToken = (adminId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }

  return jwt.sign(
    { id: adminId, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

export async function registerAdmin(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const registrationKey = String(req.body.registrationKey || "");

    if (!name || !email || !password || !registrationKey) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all fields.",
      });
    }

    if (!process.env.ADMIN_REGISTER_KEY) {
      return res.status(500).json({
        success: false,
        message: "Admin registration is not configured.",
      });
    }

    if (registrationKey !== process.env.ADMIN_REGISTER_KEY) {
      return res.status(403).json({
        success: false,
        message: "Invalid admin registration key.",
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
        message: "An admin with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Admin registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to register admin.",
    });
  }
}

export async function loginAdmin(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const admin = await Admin.findOne({ email });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = createAdminToken(admin._id.toString());

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
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in.",
    });
  }
}