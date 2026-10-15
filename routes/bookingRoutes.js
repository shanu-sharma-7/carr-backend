
import express from "express";
import authMiddleware from "../middlewares/auth.js";

import {
  createBooking,
  deleteBooking,
  getBookings,
  getMyBookings,
  updateBooking,
  updateBookingStatus,
} from "../controllers/bookingController.js";

import { uploads } from "../middlewares/uploads.js";

const bookingRouter = express.Router();

// Guest customer bina login ke booking request kar sakta hai.
bookingRouter.post("/", createBooking);

// Booking list aur changes ko admin authentication se protect karo.
// Yahan authMiddleware tabhi use karo jab woh admin role bhi verify karta ho.
bookingRouter.get("/", getBookings);

bookingRouter.get("/bybooking", authMiddleware, getMyBookings);

bookingRouter.put(
  "/:id",
  uploads.single("carImage"),
  updateBooking
);

bookingRouter.patch("/:id/status", updateBookingStatus);

bookingRouter.delete("/:id", deleteBooking);

export default bookingRouter;
