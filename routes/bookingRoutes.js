
import express from "express";
import authMiddleware from "../middlewares/auth.js";

import {
  createBooking,
  deleteBooking,
  getBookings,
  getMyBookings,
  getGuestBooking,
  getPublicBookings,
  updateBooking,
  updateBookingStatus,
} from "../controllers/bookingController.js";

import { uploads } from "../middlewares/uploads.js";

const bookingRouter = express.Router();

// PUBLIC ROUTES

bookingRouter.post("/", createBooking);

bookingRouter.post("/guest-lookup", getGuestBooking);

bookingRouter.get("/public", getPublicBookings);

// CUSTOMER ROUTES

bookingRouter.get(
  "/bybooking",
  authMiddleware,
  getMyBookings
);

// ADMIN ROUTES

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
