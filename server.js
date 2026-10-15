import express from "express"
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from "./config/db.js"
import userRouter from "./routes/userRoutes.js"

import path from 'path'
import helmet from 'helmet'
import { fileURLToPath } from "url"
import carRouter from "./routes/carRoutes.js"
import bookingRouter from "./routes/bookingRoutes.js"
import paymentRouter from "./routes/paymentRoutes.js"
import contactRouter from "./routes/contactRoutes.js";
import adminAuthRouter from "./routes/adminAuthRoutes.js";

dotenv.config()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

const app = express()
const port  = 5000

connectDB(); 
app.use(cors())
app.use(

  helmet({
    crossOriginResourcePolicy: {policy: 'cross-origin'}
  })
)
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(
  '/uploads' , (req,res,next)=>{
    res.setHeader('Access-Control-Allow-Origin' , "*");
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
)

app.use('/api/auth' , userRouter)

app.use('/api/cars' , carRouter)
app.use('/api/bookings' , bookingRouter)
app.use('/api/payments' , paymentRouter)
app.use("/api/admin-auth", adminAuthRouter);
app.use("/api/contacts", contactRouter);
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ message: err.message || 'Server Error' });
});



app.get('/api/ping' , (req,res) => res.json({

    ok: true,
    time: Date.now()
}))


app.get('/' , (req , res) =>{

    res.send('api working')
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});