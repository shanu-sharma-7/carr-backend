import jwt from "jsonwebtoken"
import User from "../models/userModels.js"
import dotenv from 'dotenv' 

dotenv.config(); 


const JWT_SECRET = process.env.JWT_SECRET


export default async function authMiddleWare(req, res, next) {
    
    
    const authHeader = req.headers.authorization 

    if(!authHeader || !authHeader.startsWith('Bearer')){

        return res.status(401).json({

            success : false,
            
            message : 'not authorized: Missing or incorrect Bearer token format' 
        })
    }

    const token = authHeader.split(' ')[1]
    try {
        const payload = jwt.verify(token , JWT_SECRET)
        
        const user = await User.findById(payload.id).select('-password') 

        if(!user){
             
            return res.status(401).json({

            success : false,
            message : 'User not found'
        })
        }

        req.user = user;
        next()
    } catch (err) {
        console.error('Jwt Verification failed:' , err)
        
        return res.status(401).json({

            success : false,
            message : 'Token invalid or expired. Please login again.'
        })
    }
}