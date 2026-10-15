import mongoose from "mongoose";
import bcrypt from 'bcrypt'
import User from '../models/userModels.js'
import validator from 'validator'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv' // 👈 FIX 1: dotenv import kiya

dotenv.config() // 👈 FIX 2: Environment variables load kiye


const TOKEN_EXPIRES_IN = '24h'
// --- FIX 3: JWT_SECRET ab .env file se load hoga ---
const JWT_SECRET = process.env.JWT_SECRET 

const createToken = (userId) => {
    const secret  = JWT_SECRET
    // Agar key load nahi hui toh server ko rok dega
    if(!secret) throw new Error ('JWT_SECRET is not defined in environment variables. Please check your .env file.')
        return jwt.sign({id: userId} , secret , {expiresIn: TOKEN_EXPIRES_IN})
}

export async function register(req,res) {
    try{
        const name = String(req.body.name || "").trim()
        const emailRaw = String(req.body.email || "").trim()
        const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase()
        const password = String(req.body.password || "")

        if(!name || !email || !password){
            return res.status(400).json({
                success : false , 
                message : 'all field are rquired'
            })
        }

             if(!validator.isEmail(email)){
            return res.status(400).json({
                success : false , 
                message : 'Invalid Email'
            })
        }


          if(password.length < 8){
            return res.status(400).json({
                success : false , 
                message : 'Password should be Greater than 8 character'
            })
        }

        const exists = await User.findOne({ email }).lean()

        if (exists){
            return res.status(400).json({
                success : false , 
                message : 'User already exists'
            }) 
        }

        const newId = new mongoose.Types.ObjectId();
        const hashedPassword = await bcrypt.hash(password ,10);

        const newUser = new User({
            _id : newId,
            name,
            email,
            password : hashedPassword
        })

       await newUser.save()
        const token = createToken(newId.toString())
       return res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email 
    }
})

    }
    catch(err){
console.log('Register error' , err)
if(err.code === 11000)
    return res.status(409).json({
success : false,
message: 'user already exists'
    })

    return res.status(500).json({
        success: false,
        message: 'server error'
    })
    }
}


export async function login(req,res) {
    try {
          const emailRaw = String(req.body.email || "").trim()
        const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase()
        const password = String(req.body.password || "")

        if(!email || !password){
            return res.status(400).json({
                success : false , 
                message : 'all field are rquired'
            })
        }
const user = await User.findOne({email})
if(!user)
     return res.status(401).json({
                success : false , 
                message : 'Invalid Email or Password'
            })

            const isMatch = await bcrypt.compare(password , user.password)
            if(!isMatch)
                return res.status(401).json({
                success : false , 
                message : 'Invalid Email or Password'
            })

        // Yahan bhi JWT_SECRET ab process.env se load hoga
        const token = jwt.sign({id:user._id} , JWT_SECRET, {expiresIn:'24h'}) 
        return res.status(200).json({
                success : true , 
                message : 'Login successfully',
                token,
                user:{
                    id:user._id,
                    name:user.name,
                    email: user.email
                }
            })

    } catch (err) {
        

        console.log('Login error' , err)
    return res.status(500).json({
        success: false,
        message: 'server error'
    })

    }
}