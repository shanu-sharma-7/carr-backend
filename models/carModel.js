
import mongoose from "mongoose";

const { Schema } = mongoose;

const BLOCKING_STATUSES = ["pending", "active", "upcoming"];

const carBookingSubSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    pickupDate: {
      type: Date,
      required: true,
    },
    returnDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "completed",
        "cancelled",
        "upcoming",
      ],
      default: "pending",
    },
  },
  { _id: false }
);

const carSchema = new Schema({
  make: {
    type: String,
    required: true,
    trim: true,
  },
  model: {
    type: String,
    required: true,
    trim: true,
  },
  year: {
    type: Number,
    required: true,
  },
  color: {
    type: String,
    default: "",
  },
  category: {
    type: String,
    default: "Sedan",
  },
  seats: {
    type: Number,
    default: 4,
  },
  transmission: {
    type: String,
    default: "Automatic",
  },
  fuelType: {
    type: String,
    default: "Gasoline",
  },
  mileage: {
    type: Number,
    default: 0,
  },
  dailyRate: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["available", "rented", "maintenance"],
    default: "available",
  },
  image: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  bookings: {
    type: [carBookingSubSchema],
    default: [],
  },
});

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// Check whether a car is available for the requested date range.
carSchema.methods.isAvailableForRange = function (
  requestedPickup,
  requestedReturn,
  blockingStatuses = BLOCKING_STATUSES
) {
  if (!requestedPickup || !requestedReturn) return false;

  const start = new Date(requestedPickup);
  const end = new Date(requestedReturn);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return false;
  }

  for (const booking of this.bookings || []) {
    if (!BLOCKING_STATUSES.includes(booking.status)) continue;
    if (!blockingStatuses.includes(booking.status)) continue;

    const bookingStart = new Date(booking.pickupDate);
    const bookingEnd = new Date(booking.returnDate);

    // Ignore incomplete or invalid legacy records here.
    // These records should still be repaired in the database.
    if (
      Number.isNaN(bookingStart.getTime()) ||
      Number.isNaN(bookingEnd.getTime()) ||
      bookingStart > bookingEnd
    ) {
      continue;
    }

    if (rangesOverlap(start, end, bookingStart, bookingEnd)) {
      return false;
    }
  }

  return true;
};

// Return a summary of the car's current availability.
carSchema.methods.getAvailabilitySummary = function (
  nowDate = new Date()
) {
  const now = new Date(nowDate);

  const bookings = (this.bookings || [])
    .filter(
      (booking) =>
        BLOCKING_STATUSES.includes(booking.status) &&
        booking.pickupDate &&
        booking.returnDate &&
        !Number.isNaN(new Date(booking.pickupDate).getTime()) &&
        !Number.isNaN(new Date(booking.returnDate).getTime()) &&
        new Date(booking.pickupDate) <= new Date(booking.returnDate)
    )
    .map((booking) => ({
      bookingId: booking.bookingId,
      status: booking.status,
      pickupDate: new Date(booking.pickupDate),
      returnDate: new Date(booking.returnDate),
    }))
    .sort((a, b) => a.pickupDate - b.pickupDate);

  const active = bookings.find(
    (booking) =>
      booking.pickupDate <= now && now <= booking.returnDate
  );

  if (active) {
    const msLeft = active.returnDate - now;
    const daysRemaining = Math.ceil(
      msLeft / (1000 * 60 * 60 * 24)
    );

    return {
      state: "booked",
      daysRemaining: Math.max(daysRemaining, 0),
      until: active.returnDate,
      bookingId: active.bookingId,
    };
  }

  const next = bookings.find((booking) => booking.pickupDate > now);

  if (next) {
    const msAvailable = next.pickupDate - now;
    const daysAvailable = Math.floor(
      msAvailable / (1000 * 60 * 60 * 24)
    );

    return {
      state: "available_until_reservation",
      daysAvailable: Math.max(daysAvailable, 0),
      nextBookingStarts: next.pickupDate,
      bookingId: next.bookingId,
    };
  }

  return { state: "fully_available" };
};

// Compute availability for a list of cars.
carSchema.statics.computeAvailabilityForCars = function (
  cars,
  nowDate = new Date()
) {
  return cars.map((car) => {
    const availability =
      typeof car.getAvailabilitySummary === "function"
        ? car.getAvailabilitySummary(nowDate)
        : { state: "fully_available" };

    if (typeof car.set === "function") {
      car.set("availability", availability);
    } else {
      car.availability = availability;
    }

    return car;
  });
};

carSchema.index({ "bookings.bookingId": 1 });

const Car =
  mongoose.models.Car || mongoose.model("Car", carSchema);

export default Car;
