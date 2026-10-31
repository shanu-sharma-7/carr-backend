
import express from "express";
import authMiddleware from "../middlewares/auth.js";

import {
  createBooking,
  deleteBooking,
  getBookings,
  getMyBookings,
  getGuestBooking,
  updateBooking,
  updateBookingStatus,
} from "../controllers/bookingController.js";

import { uploads } from "../middlewares/uploads.js";

const bookingRouter = express.Router();

// ========================================
// PUBLIC ROUTES
// ========================================

// Customer bina login booking create kar sakta hai.
bookingRouter.post("/", createBooking);

// Customer Booking ID + phone se booking check karega.
bookingRouter.post("/guest-lookup", getGuestBooking);

// ========================================
// PROTECTED CUSTOMER ROUTES
// ========================================

bookingRouter.get(
  "/bybooking",
  authMiddleware,
  getMyBookings
);

// ========================================
// ADMIN ROUTES
// ========================================

// IMPORTANT:
// In routes par apna existing admin-role middleware bhi lagao.
// Sirf authMiddleware tab use karo jab woh admin role verify karta ho.

bookingRouter.get("/", authMiddleware, getBookings);

bookingRouter.put(
  "/:id",
  authMiddleware,
  uploads.single("carImage"),
  updateBooking
);

bookingRouter.patch(
  "/:id/status",
  authMiddleware,
  updateBookingStatus
);

bookingRouter.delete(
  "/:id",
  authMiddleware,
  deleteBooking
);

export default bookingRouter;
