import express from "express";
import {
  createContactMessage,
  getContactMessages,
  updateContactStatus,
  deleteContactMessage,
} from "../controllers/contactController.js";

import protectAdmin from "../middlewares/protectAdmin.js";

const contactRouter = express.Router();

// Customer website se enquiry submit ho sakti hai.
contactRouter.post("/", createContactMessage);

// In actions ke liye admin login required hai.
contactRouter.get("/", protectAdmin, getContactMessages);
contactRouter.patch("/:id/status", protectAdmin, updateContactStatus);
contactRouter.delete("/:id", protectAdmin, deleteContactMessage);

export default contactRouter;