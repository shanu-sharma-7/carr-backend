import mongoose from "mongoose";
import Booking from '../models/bookingModel.js'
import Car from "../models/carModel.js";
import path from 'path'
import fs from 'fs'
// import { type } from "os"; // REMOVED: Unused import

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const BLOCKING_STATUSES = ["pending", "active", "upcoming"];

const tryParseJSON = (v) =>{
    if(typeof v !== 'string') return v;
    try {return JSON.parse(v);} catch {return v;}
}

const buildCarSummary = (src = {}) =>{
const id = src._id?.toString?.() || src.id || null

return {
    id,
    make: src.make,
    model: src.model || "",
    year: src.year ? Number(src.year) : null,
    dailyRate: src.dailyRate ? Number(src.dailyRate) : 0,
    seats: src.seats ? Number(src.seats) : 4,
    transmission: src.transmission,
    fuelType: src.fuelType,
    mileage: src.mileage ? Number(src.mileage) : 0,
    image: src.image || src.carImage || "",
  };

}


const deleteLocalFileIfPresent = (filePath) =>{
if(!filePath) return;
const filename = filePath.replace(/^\/uploads\//, '');
const full = path.join(UPLOADS_DIR , filename);
fs.unlink(full , (err)=> {if(err) console.warn( 'failed to delete file' , full ,err);})

}


export const createBooking = async (req,res) =>{
    
    // 🔥 FINAL FIX: 5 Retries with delay for extreme concurrent access
    const MAX_RETRIES = 5; 
    let retries = 0;

    while (retries < MAX_RETRIES) {
        
        // 🌟 FIX: Transaction options with 'majority' read concern to ensure fresh data is read
        const session = await mongoose.startSession();
        session.startTransaction({ readConcern: { level: 'majority' } });

        try {

            let { customer, email, phone, car, pickupDate, returnDate, amount, details, address, carImage } = req.body;
            
            // 1. Check for required fields
            if(!customer || !email || !phone || !car || !pickupDate || !returnDate){
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({
                    success : false,
                    message: 'missing required field '
                })
            }

            // 2. Date validation
            const pickup = new Date(pickupDate);
            const ret = new Date(returnDate)

            if(Number.isNaN(pickup.getTime()) || Number.isNaN(ret.getTime()) || pickup > ret){
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({
                    success : false,
                    message: 'Invalid pickup and return date'
                })
            }
            
            // 3. Car existence and summary check
            let carSummary = null;
            
            if (typeof car === "string" && /^[0-9a-fA-F]{24}$/.test(car)) {
              // ReadConcern is inherited from transaction session
              const carDoc = await Car.findById(car).session(session).lean(); 
              if (!carDoc) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: "Car not found" }); }
              carSummary = buildCarSummary(carDoc);
            } else {
              const parsed = tryParseJSON(car) || car;
              carSummary = buildCarSummary(parsed);
              if (!carSummary.id) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: "Invalid car payload" }); }
              // ReadConcern is inherited from transaction session
              const carExists = await Car.exists({ _id: carSummary.id }).session(session); 
              if (!carExists) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: "Car not found" }); }
            }
            const carId = carSummary.id;
            
            // 4. Overlapping check 
            const overlappingCount = await Booking.countDocuments({
              "car.id": carId,
              status: { $in: BLOCKING_STATUSES },
              pickupDate: { $lte: ret },
              returnDate: { $gte: pickup },
            }).session(session);

            if(overlappingCount > 0){
                 await session.abortTransaction(); session.endSession();
                return res.status(409).json({
                    success : false,
                    message: 'Car already booked'
                })
            }
            
            // 5. Create booking (Write 1)
            const bookingData = {
              userId: req?.user?.id || req.user?._id || null,
              customer, email, phone,
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
            // NOTE: Hook disabled, so it's safe now
            const createdArr = await Booking.create([bookingData] , {session})
            const createdBooking = createdArr[0]

            // 6. Prepare car update entry
            const bookingEntry = {
                bookingid : createdBooking._id,
                pickupDate : createdBooking.pickupDate,
                returnDate : createdBooking.returnDate,
                status : createdBooking.status,
            }

            // 7. Update car document (Write 2) - This was failing due to the hook
            await Car.findByIdAndUpdate(carId , {$push: {bookings : bookingEntry}}, {session})
            
            // 8. Commit Transaction (Success Path)
            await session.commitTransaction();
            session.endSession();
            const saved = await Booking.findById(createdBooking._id).lean();
            
            // Success: Exit loop and return
            return res.status(201).json({
                success: true,
                booking: saved
            })

        } catch (err) {
            await session.abortTransaction().catch(() => {});
            session.endSession();
            
            // 🔥 Write Conflict Error Check
            if (err.code === 112 || err.codeName === 'WriteConflict') {
                retries++;
                console.warn(`Write conflict detected. Retrying transaction (Attempt ${retries}/${MAX_RETRIES}).`);
                
                // Added: Small delay to allow other transaction to commit
                if (retries < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 50)); 
                    continue; // Retry the while loop
                }
                
                break; // Max retries reached, fail outside the loop
            }

            // Other errors
            console.error('create booking error' , err);
            return res.status(500).json({
                success: false,
                message: err.message
            })
        }
    }
    
    // Final error message if all retries failed
    return res.status(500).json({
        success: false,
        message: 'Transaction failed due to extreme concurrent access. Please try again after a moment.'
    });

}


export const getBookings = async (req,res,next)=>{
    try {
    
         const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 12, 100);
    const search = req.query.search?.trim() || "";
    const status = req.query.status?.trim() || "";
    const carFilter = req.query.car?.trim() || "";
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const query = {};
    if (search) {
      const q = { $regex: search, $options: "i" };
      query.$or = [{ customer: q }, { email: q }, { "car.make": q }, { "car.model": q }];
    }


    if(status) query.status = status;
    
    if (carFilter) {
      if (/^[0-9a-fA-F]{24}$/.test(carFilter)) query["car.id"] = carFilter;
      else query.$or = [...(query.$or || []), { "car.make": { $regex: carFilter, $options: "i" } }, { "car.model": { $regex: carFilter, $options: "i" } }];
    }

if(from || to ){
    query.pickupDate = {};
    if (from) query.pickupDate.$gte = from;
    if (to) query.pickupDate.$lte = to;

}

const total = await Booking.countDocuments(query);
const bookings = await Booking.find(query)
.sort({bookingData: -1})
.skip((page - 1) * limit)
.limit(limit)
.lean();

res.json({

    page,
    pages: Math.ceil(total / limit),
    total,
    data: bookings
})


    } 
    
    catch (err) {
        next(err)
    }
}

export const getMyBookings = async (req,res,next) => {
try {

    if(!req.user || (!req.user.id && !req.user._id))
        return res.status(401).json({ success: false , message:'unauthorized'});

    const userId = req.user._id || req.user.id;
    const bookings = await Booking.find({userId}).sort({bookingDate: -1}).lean();
    res.json(bookings)
} 

catch (err) {
    next(err)
}
}


export const updateBooking = async (req , res , next)=>{
    // NOTE: This controller should ideally be wrapped in a transaction too, 
    // but the main fix is applied to createBooking first.
    try {
    
        const booking = await Booking.findById(req.params.id);
        if(!booking) return res.status(404).json({
            message: 'Booking not found'
        })

         if (req.file) {
      if (booking.carImage && booking.carImage.startsWith("/uploads/")) deleteLocalFileIfPresent(booking.carImage);
      booking.carImage = `/uploads/${req.file.filename}`;
    } else if (req.body.carImage !== undefined) {
      if (req.body.carImage && !String(req.body.carImage).startsWith("/uploads/") && booking.carImage && booking.carImage.startsWith("/uploads/")) {
        deleteLocalFileIfPresent(booking.carImage);
      }
      booking.carImage = req.body.carImage || booking.carImage;
    }
  const updatable = ["customer", "email", "phone", "car", "pickupDate", "returnDate", "bookingDate", "status", "amount", "details", "address"];
    for (const f of updatable) {
      if (req.body[f] === undefined) continue;
      if (["pickupDate", "returnDate", "bookingDate"].includes(f)) booking[f] = new Date(req.body[f]);
      else if (f === "amount") booking[f] = Number(req.body[f]);
      else if (f === "details" || f === "address") booking[f] = tryParseJSON(req.body[f]);
      else if (f === "car") {
        const c = tryParseJSON(req.body.car);
        if (c) {
          const summary = buildCarSummary(c);
          if (!summary.id && booking.car?.id) summary.id = booking.car.id;
          booking.car = summary;
        }
      } else booking[f] = req.body[f];
    }

    const updated = await booking.save();
    // TODO: If status changes, manually update the Car document's bookings array here (since hook is gone)
    res.json(updated)
    } 
    
    catch (err) {
        next(err)
    }
}


export const updateBookingStatus = async (req , res , next) =>{
    // NOTE: This controller should also manually update the Car document's bookings array if the status is a blocking status
    try {
       const {status} = req.body;
       if (!status) return res.status(400).json({message: 'status is required'})
        const booking = await Booking.findById(req.params.id)
     if(!booking) return res.status(404).json({message: 'Booking not found'})
        booking.status = status;
    const updated = await booking.save();
    res.json(updated)


    } catch (err) {
        next(err)
    }
}


export const deleteBooking = async (req , res , next) =>{

    try {
        
        const booking = await Booking.findById(req.params.id)
        if(!booking) return res.status(404).json({message: 'Booking not found'})
        const carId = booking.car.id;

        if(booking.carImage && booking.carImage.startsWith('/uploads'))
            deleteLocalFileIfPresent(booking.carImage);

        // Manually remove booking entry from Car document (since hook is gone)
        if (carId) {
             await Car.findByIdAndUpdate(carId, {
                $pull: { bookings: { bookingId: booking._id } }
            }).exec();
        }

        await Booking.findByIdAndDelete(req.params.id);
        
        res.json({message: 'Booking delete successfully'})

    } catch (err) {
        next(err)
    }
}