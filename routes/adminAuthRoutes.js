import express from "express";
import {
  loginAdmin,
  registerAdmin,
} from "../controllers/adminAuthController.js";

const adminAuthRouter = express.Router();

adminAuthRouter.post("/login", loginAdmin);
adminAuthRouter.post("/register", registerAdmin);

export default adminAuthRouter;