const User=require("../../models/userModel")
const Product=require("../../models/productModel")
const Brand=require("../../models/brandModel")
const Categories=require("../../models/category")
const Cart=require("../../models/cartModel")
const bcrypt=require("bcrypt")

const nodemailer=require("nodemailer")
const { sendOtpByEmail } = require("./sendOtp")
const express=require("express")
const session = require("express-session")
const {OAuth2Client} = require("google-auth-library")
const client =new OAuth2Client("142815468591-rc6ar61c1r1sd4sm1nsv0h5cos2r6hk6.apps.googleusercontent.com")



const generateOtpCode=()=>Math.floor(100000 +Math.random() * 900000).toString()

const userController={
    loadRegisterPage:async (req,res) => {
       try{
        res.render("user/signup")
       }
       catch(error){
        console.log(error.message)
       } 
    },

    verifyRegister:async (req,res) => {
        try {
            console.log("verify register req.body",req.body)
            const{fullname,email,password,phone,confirmPassword}=req.body
            console.log("fullname:",fullname,"email:",email)
            // if(fullname==="sidharth"){
            //     return res.status(400).json({message:"name is not correct",success:false})
            // }

            const regexPatterns = {
                fullname: /^[A-Za-z\s]{3,50}$/,
                email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/,
                phone: /^[6-9]\d{9}$/
            };

            if(!fullname.trim()){
                return res.status(400).json({message:"fullname is required"})
            }
            else if(!regexPatterns.fullname.test(fullname)){
                return res.status(400).json({message:"Name is invalid,only letters and spaces are allowed"})
            }
            if(!email.trim()){
                return res.status(400).json({message:"email is required"})
            }
            else if(!regexPatterns.email.test(email)){
                return res.status(400).json({message:"Invalid email format"})
            }
            if(!phone.trim()){
                return res.status(400).json({message:"phone number is required"})
            }
            else if(!regexPatterns.phone.test(phone)){
                return res.status(400).json({message:"Invalid phone number.Must be a 10-digit number starting with 6-9"})
            }
            if(!password.trim()){
                return res.status(400).json({message:"password is required"})
            }
            else if(!regexPatterns.password.test(password)){
               return res.status(400).json({message:"Password must be 8-20 characters, include at least one letter, one number, and one special character"})
            }
            if(password!==confirmPassword){
                return res.status(400).json({message:"password and confirm password must be match"})
            }


            const existingUser=await User.findOne({email})
            if(existingUser){
                return res.status(400).json({message:"user already existing"})
            }
            const hashedPassword = await bcrypt.hash(password, 10);

            console.log(hashedPassword)
            
          
            req.session.name=fullname,
            req.session.phone=phone,
            req.session.email=email,
            req.session.password=hashedPassword
            

            const otp = generateOtpCode()
            const expiresAt=Date.now() + 60  * 1000
            req.session.otpData={otp,expiresAt}
            console.log(otp)
            await sendOtpByEmail(email,otp)
            
            return res.status(200).json({success:true,redirectUrl:"/user/enterOtp"})


           
        } catch (error) {
            console.log(error.message)
        }
    },
    loadOtpPage:async (req,res) => {
        try {
            res.render("user/otp")
        } catch (error) {
            console.log(error.message)
        }
    },
   
    verifyOtp:async (req,res) => {
        try {
            console.log("verify otp req.body",req.body)
            const {otp}=req.body
            console.log("otp:",otp)
            console.log("session data of user : ","email:",req.session.email,"\n","phone:",req.session.phone,"\n","name:",req.session.name,"\n","password:",req.session.password)

            const otpRegex = /^\d{6}$/;


            if(!otp.trim()){
                return res.status(400).json({message:"otp is required"})
            }
            else if(!otpRegex.test(otp)){
                return res.status(400).json({message:"invalid otp"})
            }

            const storedOtpData=req.session.otpData

            if(!storedOtpData){
                return res.status(400).json({message:"No otp found,Request a new one"})
            }

            const {otp:storedOtp,expiresAt} = storedOtpData

            if(Date.now()>expiresAt){
                delete req.session.otpData
                return res.status(400).json({message:"OTP has expired,request a new one"})
            }

            if(otp!==storedOtp){
                return res.status(400).json({message:"Invalid otp,please try again"})
            }

            delete req.session.otpData
            // return res.status(200).json({success:true ,message:"OTP verified successfully"})

            const newUser=new User({
                email:req.session.email,
                password:req.session.password,
                fullname:req.session.name,
                phoneNumber:req.session.phone
            })
            
            await newUser.save()

           return res.status(200).json({success:true,redirectUrl:"/user/userLogin"})

        } catch (error) {
            console.log(error.message)
        }
    },
    resendOtp:async (req,res) => {
        try {
            const email=req.session.email
            if(!email){
                return res.status(400).json({message:"No email found. Please start registration again."})
            }
            const otp=generateOtpCode()
            const expiresAt =Date.now() + 60 * 1000

            req.session.otpData={otp,expiresAt}
            console.log("Resend otp:",otp)

            await sendOtpByEmail(email,otp)
            return res.status(200).json({message:"otp send successfully"})


        } catch (error) {
            console.log(error.message)
        }
    },
    loadUserLogin:async (req,res) => {
        try {
            res.render("user/userLogin")
        } catch (error) {
            console.log(error.message)
        }
        
    },
    verifyLogin:async (req,res) => {
        try {
            console.log("verify login req.body:",req.body)
            const {email,password}=req.body
            console.log("email:",email,"password:",password)

            const regexPatterns = {
               
                email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/,
                
            };

            if(!email.trim()||!password.trim()){
                return res.status(400).json({message:"email and password is required"})
            }

            if(!regexPatterns.email.test(email)){
                returnres.status(400).json({message:"Name is invalid,only letters and spaces are allowed"})
            }

            if(!regexPatterns.password.test(password)){
                return res.status(400).json({message:"Password must be 8-20 characters, include at least one letter, one number, and one special character"})
            }

           const user = await User.findOne({email})
           if(!user){
            return res.status(400).json({message:"User not found,please sign up"})
           }

           if(!user.isActive){
            return res.status(400).json({message:"Blocked user"})
           }

           const isPasswordValid = await bcrypt.compare(password,user.password)
           if(!isPasswordValid){
            return res.status(400).json({message:"Invalid password.please try again"})
           }
            
           req.session.user={
            fullname:user.fullname,
            userId:user._id,
            isActive:user.isActive,
            email:user.email
           }

           console.log("hai:",req.session.user)

            return res.status(200).json({success:true,redirectUrl:"/user/userHome"})

        } catch (error) {
            console.log(error.message)
        }
    },
    loadUserHome:async (req,res) => {
        try {
            const user=req.session.user
            const userId=req.session.user.userId
           const products=await Product.find().populate("categoryId","name").populate("brand","name").limit(4)
           const brands=await Brand.find().limit(4)
           const categories=await Categories.find({}).limit(4)
            let cart=await Cart.findOne({userId})
            console.log("vvff:",cart)
            if(!cart){
                cart={items: []}
            }
            res.render("user/userHome",{user,products,brands,categories,cart})
        } catch (error) {
            console.log(error.message)
        }
    },
    googleLogin:async (req,res) => {
        try {
            const {token} = req.body
            if(!token){
                return res.status(400).json({success:false,message:"Token is required"})
            }

            const ticket = await client.verifyIdToken({
                idToken:token,
                audience:"142815468591-rc6ar61c1r1sd4sm1nsv0h5cos2r6hk6.apps.googleusercontent.com"
            })

            const payload = ticket.getPayload()
            console.log("Decoded Google token:",payload)

            const {email,name,picture} = payload

            let user = await User.findOne({email})

            if(!user){
                user = new User({email,name,profilePic:picture,googleAuth:true})
                await user.save()
            }

            req.session.user=user
            return res.status(200).json({success:true,message:"user verified successfully",redirectUrl:"/user/userHome"})

        } catch (error) {
            console.log(error.message)
        }
    },
    loadForgotPassword:async (req,res) => {
        try {
            res.render("user/forgot")
        } catch (error) {
            console.log(error.message)
        }
    },
    sendForgotOtp:async (req,res) => {
        try {
            const {email}=req.body
            console.log("hi mail:",email)
            const user=await User.findOne({email})
            if(!user){
                return res.json({success:false,message:"user not found"})
            }

                const otp = generateOtpCode()
                const expiresAt=Date.now() +5 * 60  * 1000
                req.session.userEmail=email
                user.otp=otp
                user.expiresAt=expiresAt
                console.log(otp)
                await user.save()
                await sendOtpByEmail(email,otp)
               
                
    res.json({ success: true, message: "OTP sent to your email" });
            
        } catch (error) {
            console.log(error.message)
        }
    },
    loadResetPassword:async (req,res) => {
        try {
            res.render("user/resetPassword")
        } catch (error) {
            console.log(error.message)
        }
    },
    enterNewPassword:async (req,res) => {
        try {
            const {email,otp,newPassword,confirmPassword}=req.body
            console.log("hi req:",req.body)
            console.log("emil : ",email);
            if(!req.session.userEmail){
                return res.status(400).json({message:"email not found"})
            }

            if(newPassword!==confirmPassword){
                return res.status(400).json({message:"password and confirm password must be same"})
            }

            if(!newPassword.trim()||!confirmPassword.trim()){
                return res.status(400).json({message:"Enter password and New password"})
            }

            if(!otp.trim()){
                return res.status(400).json({message:"Enter otp"})
            }

            const passwordRegex=/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/
            const otpRegex=/^\d{6}$/


            if(!passwordRegex.test(newPassword)||!passwordRegex.test(confirmPassword)){
                return res.status(400).json({message:"Password must be 8-20 characters, include at least one letter, one number, and one special character"})
            }

            if(!otpRegex.test(otp)){
                return res.status(400).json({message: "Invalid OTP, it should be a 6-digit number"})
            }



            
            
            const user=await User.findOne({email:req.session.userEmail})
            console.log("user found:",user)
            if(!user) return res.json({success:false,message:"Invalid or expired OTP"})

                user.password=await bcrypt.hash(newPassword,10)
                user.otp=undefined
                user.expiresAt=undefined
                await user.save()

                
    res.json({ success: true, redirectUrl: '/user/userLogin' });
            
        } catch (error) {
            console.log(error.message)
        }
    },
    logout:async (req,res) => {
        try {
            req.session.destroy()

            return res.status(200).json({redirectUrl:"/userLogin" })
        } catch (error) {
            console.log(error.message)
        }
    }
}


module.exports=userController
