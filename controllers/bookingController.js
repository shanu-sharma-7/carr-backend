
import mongoose from "mongoose";
import Booking from "../models/bookingModel.js";
import Car from "../models/carModel.js";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const BLOCKING_STATUSES = ["pending", "active", "upcoming"];

const tryParseJSON = (value) => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const buildCarSummary = (src = {}) => {
  const id = src._id?.toString?.() || src.id || null;

  return {
    id,
    make: src.make || "",
    model: src.model || "",
    year: src.year ? Number(src.year) : null,
    dailyRate: src.dailyRate ? Number(src.dailyRate) : 0,
    category: src.category || "Sedan",
    seats: src.seats ? Number(src.seats) : 4,
    transmission: src.transmission || "",
    fuelType: src.fuelType || "",
    mileage: src.mileage ? Number(src.mileage) : 0,
    image: src.image || src.carImage || "",
  };
};

const deleteLocalFileIfPresent = (filePath) => {
  if (!filePath) return;

  const filename = filePath.replace(/^\/uploads\//, "");
  const fullPath = path.join(UPLOADS_DIR, filename);

  fs.unlink(fullPath, (err) => {
    if (err) {
      console.warn("Failed to delete file:", fullPath, err);
    }
  });
};

// ========================================
// CREATE BOOKING - GUEST BOOKING
// ========================================

export const createBooking = async (req, res) => {
  const MAX_RETRIES = 5;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: "majority" },
      });

      const {
        customer,
        email,
        phone,
        car,
        pickupDate,
        returnDate,
        amount,
        details,
        address,
        carImage,
      } = req.body;

      if (
        !customer ||
        !email ||
        !phone ||
        !car ||
        !pickupDate ||
        !returnDate
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Missing required fields.",
        });
      }

      const pickup = new Date(pickupDate);
      const ret = new Date(returnDate);

      if (
        Number.isNaN(pickup.getTime()) ||
        Number.isNaN(ret.getTime()) ||
        pickup >= ret
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Invalid pickup and return dates.",
        });
      }

      let carSummary;

      if (
        typeof car === "string" &&
        /^[0-9a-fA-F]{24}$/.test(car)
      ) {
        const carDoc = await Car.findById(car)
          .session(session)
          .lean();

        if (!carDoc) {
          await session.abortTransaction();

          return res.status(404).json({
            success: false,
            message: "Car not found.",
          });
        }

        carSummary = buildCarSummary(carDoc);
      } else {
        const parsedCar = tryParseJSON(car) || car;

        carSummary = buildCarSummary(parsedCar);

        if (
          !carSummary.id ||
          !mongoose.Types.ObjectId.isValid(carSummary.id)
        ) {
          await session.abortTransaction();

          return res.status(400).json({
            success: false,
            message: "Invalid car details.",
          });
        }

        const carExists = await Car.exists({
          _id: carSummary.id,
        }).session(session);

        if (!carExists) {
          await session.abortTransaction();

          return res.status(404).json({
            success: false,
            message: "Car not found.",
          });
        }
      }

      const carId = carSummary.id;

      const overlappingCount = await Booking.countDocuments({
        "car.id": carId,
        status: { $in: BLOCKING_STATUSES },
        pickupDate: { $lt: ret },
        returnDate: { $gt: pickup },
      }).session(session);

      if (overlappingCount > 0) {
        await session.abortTransaction();

        return res.status(409).json({
          success: false,
          message: "Car already booked for selected dates.",
        });
      }

      const bookingData = {
        userId: req.user?.id || req.user?._id || null,
        customer: String(customer).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        car: carSummary,
        carImage: carImage || carSummary.image || "",
        pickupDate: pickup,
        returnDate: ret,
        amount: Number(amount || 0),
        details: tryParseJSON(details),
        address: tryParseJSON(address),
        paymentStatus: "pending",
        status: "pending",
      };

      const createdArr = await Booking.create(
        [bookingData],
        { session }
      );

      const createdBooking = createdArr[0];

      await Car.findByIdAndUpdate(
        carId,
        {
          $push: {
            bookings: {
              bookingid: createdBooking._id,
              pickupDate: createdBooking.pickupDate,
              returnDate: createdBooking.returnDate,
              status: createdBooking.status,
            },
          },
        },
        { session }
      );

      await session.commitTransaction();

      const saved = await Booking.findById(
        createdBooking._id
      ).lean();

      return res.status(201).json({
        success: true,
        message: "Booking created successfully.",
        booking: saved,
      });

    } catch (err) {
      await session.abortTransaction().catch(() => {});

      if (err.code === 112 || err.codeName === "WriteConflict") {
        retries++;

        if (retries < MAX_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, 50)
          );

          continue;
        }
      }

      console.error("Create booking error:", err);

      return res.status(500).json({
        success: false,
        message: "Unable to create booking.",
      });

    } finally {
      await session.endSession();
    }
  }

  return res.status(500).json({
    success: false,
    message:
      "Transaction failed. Please try again after a moment.",
  });
};

// ========================================
// GUEST BOOKING LOOKUP
// ========================================

export const getGuestBooking = async (req, res, next) => {
  try {
    const { bookingId, phone } = req.body;

    if (!bookingId || !phone) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and phone number are required.",
      });
    }

    const cleanBookingId = String(bookingId).trim();

    if (!mongoose.Types.ObjectId.isValid(cleanBookingId)) {
      return res.status(404).json({
        success: false,
        message: "Booking not found. Please check your details.",
      });
    }

    const booking = await Booking.findById(
      cleanBookingId
    ).lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found. Please check your details.",
      });
    }

    const savedPhone = String(booking.phone || "").replace(
      /\D/g,
      ""
    );

    const enteredPhone = String(phone).replace(/\D/g, "");

    if (
      !savedPhone ||
      !enteredPhone ||
      savedPhone !== enteredPhone
    ) {
      return res.status(404).json({
        success: false,
        message: "Booking not found. Please check your details.",
      });
    }

    return res.status(200).json({
      success: true,
      booking: {
        _id: booking._id,
        customer: booking.customer,
        email: booking.email,
        phone: booking.phone,
        car: booking.car,
        carImage: booking.carImage,
        pickupDate: booking.pickupDate,
        returnDate: booking.returnDate,
        bookingDate: booking.bookingDate,
        status: booking.status,
        amount: booking.amount,
        paymentStatus: booking.paymentStatus,
        address: booking.address,
      },
    });

  } catch (err) {
    next(err);
  }
};

// ========================================
// GET ALL BOOKINGS - ADMIN
// ========================================

export const getBookings = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 12, 1),
      100
    );

    const search = req.query.search?.trim() || "";
    const status = req.query.status?.trim() || "";
    const carFilter = req.query.car?.trim() || "";

    const from = req.query.from
      ? new Date(req.query.from)
      : null;

    const to = req.query.to
      ? new Date(req.query.to)
      : null;

    const query = {};

    if (search) {
      const regex = {
        $regex: search,
        $options: "i",
      };

      query.$or = [
        { customer: regex },
        { email: regex },
        { phone: regex },
        { "car.make": regex },
        { "car.model": regex },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (carFilter) {
      const carCondition = mongoose.Types.ObjectId.isValid(
        carFilter
      )
        ? { "car.id": carFilter }
        : {
            $or: [
              {
                "car.make": {
                  $regex: carFilter,
                  $options: "i",
                },
              },
              {
                "car.model": {
                  $regex: carFilter,
                  $options: "i",
                },
              },
            ],
          };

      if (carCondition.$or) {
        query.$and = [
          ...(query.$and || []),
          carCondition,
        ];
      } else {
        Object.assign(query, carCondition);
      }
    }

    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date filter.",
      });
    }

    if (from || to) {
      query.pickupDate = {};

      if (from) query.pickupDate.$gte = from;
      if (to) query.pickupDate.$lte = to;
    }

    const total = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      page,
      pages: Math.ceil(total / limit),
      total,
      data: bookings,
    });

  } catch (err) {
    next(err);
  }
};

// ========================================
// GET LOGGED-IN USER BOOKINGS
// ========================================

export const getMyBookings = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const userId = req.user._id || req.user.id;

    const bookings = await Booking.find({
      userId,
    })
      .sort({ bookingDate: -1 })
      .lean();

    return res.json({
      success: true,
      bookings,
    });

  } catch (err) {
    next(err);
  }
};

// ========================================
// UPDATE BOOKING
// ========================================

export const updateBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (req.file) {
      if (
        booking.carImage &&
        booking.carImage.startsWith("/uploads/")
      ) {
        deleteLocalFileIfPresent(booking.carImage);
      }

      booking.carImage = `/uploads/${req.file.filename}`;

    } else if (req.body.carImage !== undefined) {
      if (
        req.body.carImage &&
        !String(req.body.carImage).startsWith("/uploads/") &&
        booking.carImage?.startsWith("/uploads/")
      ) {
        deleteLocalFileIfPresent(booking.carImage);
      }

      booking.carImage = req.body.carImage || booking.carImage;
    }

    const updatable = [
      "customer",
      "email",
      "phone",
      "car",
      "pickupDate",
      "returnDate",
      "bookingDate",
      "status",
      "amount",
      "details",
      "address",
    ];

    for (const field of updatable) {
      if (req.body[field] === undefined) continue;

      if (
        ["pickupDate", "returnDate", "bookingDate"].includes(field)
      ) {
        booking[field] = new Date(req.body[field]);

      } else if (field === "amount") {
        booking[field] = Number(req.body[field]);

      } else if (
        field === "details" ||
        field === "address"
      ) {
        booking[field] = tryParseJSON(req.body[field]);

      } else if (field === "car") {
        const parsedCar = tryParseJSON(req.body.car);

        if (parsedCar) {
          const summary = buildCarSummary(parsedCar);

          if (!summary.id && booking.car?.id) {
            summary.id = booking.car.id;
          }

          booking.car = summary;
        }

      } else {
        booking[field] = req.body[field];
      }
    }

    const updated = await booking.save();

    return res.json({
      success: true,
      message: "Booking updated successfully.",
      booking: updated,
    });

  } catch (err) {
    next(err);
  }
};

// ========================================
// UPDATE BOOKING STATUS
// ========================================

export const updateBookingStatus = async (
  req,
  res,
  next
) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "active",
      "upcoming",
      "completed",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status.",
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    booking.status = status;

    const updated = await booking.save();

    // Keep the car's booking status synchronized.
    await Car.updateOne(
      {
        _id: booking.car.id,
        "bookings.bookingid": booking._id,
      },
      {
        $set: {
          "bookings.$.status": status,
        },
      }
    );

    return res.json({
      success: true,
      message: "Booking status updated.",
      booking: updated,
    });

  } catch (err) {
    next(err);
  }
};

// ========================================
// DELETE BOOKING
// ========================================

export const deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    const carId = booking.car?.id;

    if (booking.carImage?.startsWith("/uploads/")) {
      deleteLocalFileIfPresent(booking.carImage);
    }

    if (carId) {
      await Car.findByIdAndUpdate(carId, {
        $pull: {
          bookings: {
            bookingid: booking._id,
          },
        },
      });
    }

    await Booking.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: "Booking deleted successfully.",
    });

  } catch (err) {
    next(err);
  }
};
