
import mongoose from "mongoose";

const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    street: String,
    city: String,
    state: String,
    zipCode: String,
  },
  {
    _id: false,
    default: {},
  }
);

const carSummarySchema = new Schema(
  {
    id: {
      type: Schema.Types.ObjectId,
      ref: "Car",
      required: true,
    },
    make: {
      type: String,
      default: "",
    },
    model: {
      type: String,
      default: "",
    },
    year: Number,
    dailyRate: {
      type: Number,
      default: 0,
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
      default: "",
    },
    fuelType: {
      type: String,
      default: "",
    },
    mileage: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  }
);

const bookingSchema = new Schema(
  {
    // Optional: guest bookings ke liye userId null rahega
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    customer: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    car: {
      type: carSummarySchema,
      required: true,
    },

    carImage: {
      type: String,
      default: "",
    },

    pickupDate: {
      type: Date,
      required: true,
    },

    returnDate: {
      type: Date,
      required: true,
    },

    bookingDate: {
      type: Date,
      default: Date.now,
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

    amount: {
      type: Number,
      default: 0,
    },

    details: {
      type: Schema.Types.Mixed,
      default: {},
    },

    address: {
      type: addressSchema,
      default: {},
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    paymentIntentId: {
      type: String,
      default: "",
    },

    paymentDetails: {
      type: Schema.Types.Mixed,
      default: {},
    },

    sessionId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Booking create aur delete ke dauran Car update ka logic
// bookingController.js mein handle hota hai.

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
