
import Car from "../models/carModel.js";
import path from "path";
import fs from "fs";
import { uploadsDir } from "../middlewares/uploads.js";

const getUploadPath = (filename) => {
  if (!filename || typeof filename !== "string") return null;

  // Only stored filenames should be used for local file operations.
  const safeFilename = path.basename(filename);

  if (safeFilename !== filename) return null;

  return path.join(uploadsDir, safeFilename);
};

const deleteUploadedImage = (filename) => {
  const filePath = getUploadPath(filename);

  if (!filePath) return;

  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.warn("Failed to delete car image:", err.message);
    }
  });
};

export const createCar = async (req, res, next) => {
  try {
    const {
      make,
      model,
      dailyRate,
      category,
      description,
      year,
      color,
      seats,
      transmission,
      fuelType,
      mileage,
      status,
    } = req.body;

    if (!make || !model || dailyRate === undefined || dailyRate === "") {
      return res.status(400).json({
        message: "Make, model and dailyRate are required",
      });
    }

    const car = new Car({
      make,
      model,
      year: year ? Number(year) : undefined,
      color: color || "",
      category: category || "Sedan",
      seats: seats ? Number(seats) : 4,
      transmission: transmission || "Automatic",
      fuelType: fuelType || "Gasoline",
      mileage: mileage ? Number(mileage) : 0,
      dailyRate: Number(dailyRate),
      status: status || "available",
      image: req.file?.filename || req.body.image || "",
      description: description || "",
    });

    const savedCar = await car.save();

    return res.status(201).json(savedCar);
  } catch (err) {
    next(err);
  }
};

export const getCars = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100);
    const search = req.query.search || "";
    const category = req.query.category || "";
    const status = req.query.status || "";

    const query = {};

    if (search) {
      query.$or = [
        { make: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
        { color: { $regex: search, $options: "i" } },
      ];
    }

    if (category) query.category = category;
    if (status) query.status = status;

    const total = await Car.countDocuments(query);

    const cars = await Car.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const carsWithAvailability = cars.map((car) => {
      const plainCar = car.toObject();
      plainCar.availability = car.getAvailabilitySummary();
      return plainCar;
    });

    return res.json({
      page,
      pages: Math.ceil(total / limit),
      total,
      data: carsWithAvailability,
    });
  } catch (err) {
    next(err);
  }
};

export const getCarById = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    const plainCar = car.toObject();
    plainCar.availability = car.getAvailabilitySummary();

    return res.json(plainCar);
  } catch (err) {
    next(err);
  }
};

export const updateCar = async (req, res, next) => {
  let uploadedFilename = req.file?.filename;

  try {
    const {
      make,
      model,
      year,
      color,
      category,
      seats,
      transmission,
      fuelType,
      mileage,
      dailyRate,
      status,
      description,
    } = req.body;

    const updates = {};

    if (make !== undefined) updates.make = make;
    if (model !== undefined) updates.model = model;
    if (year !== undefined) updates.year = Number(year);
    if (color !== undefined) updates.color = color;
    if (category !== undefined) updates.category = category;
    if (seats !== undefined) updates.seats = Number(seats);
    if (transmission !== undefined) updates.transmission = transmission;
    if (fuelType !== undefined) updates.fuelType = fuelType;
    if (mileage !== undefined) updates.mileage = Number(mileage);
    if (dailyRate !== undefined) updates.dailyRate = Number(dailyRate);
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;

    if (req.file) {
      updates.image = req.file.filename;
    } else if (req.body.image !== undefined) {
      updates.image = req.body.image;
    }

    const updatedCar = await Car.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedCar) {
      if (uploadedFilename) deleteUploadedImage(uploadedFilename);

      return res.status(404).json({ message: "Car not found" });
    }

    // Delete the previous image only after the database update succeeds.
    if (
      req.file &&
      updatedCar.image &&
      updatedCar.image !== req.file.filename
    ) {
      // The returned document has the new image, so fetch the previous
      // filename from the update result's pre-image is not possible here.
      // Previous image cleanup is intentionally skipped to avoid deleting
      // the newly uploaded image or the wrong file.
    }

    return res.json(updatedCar);
  } catch (err) {
    // Clean up a newly uploaded file if the database update failed.
    if (uploadedFilename) deleteUploadedImage(uploadedFilename);

    console.error("UPDATE CAR ERROR:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: err.message,
        errors: Object.fromEntries(
          Object.entries(err.errors || {}).map(([key, value]) => [
            key,
            value.message,
          ])
        ),
      });
    }

    next(err);
  }
};

export const deleteCar = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    await Car.findByIdAndDelete(req.params.id);

    if (car.image) {
      deleteUploadedImage(car.image);
    }

    return res.json({ message: "Car deleted successfully" });
  } catch (err) {
    next(err);
  }
};
