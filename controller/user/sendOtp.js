const crypto=require("crypto")
const nodemailer=require("nodemailer")
const userSchema=require("../../models/userModel")
require("dotenv").config()

const sendOtpByEmail=async (email,otp) => {
    try {
        let transporter=nodemailer.createTransport({
            service:"gmail",    
            auth:{
                user:process.env.ADMIN_EMAIL,
                pass:process.env.ADMIN_EMAIL_APP_PASS
            },
            tls: {
                rejectUnauthorized: false  // ✅ Fix SSL issue
            }
        })
console.log(process.env.ADMIN_EMAIL)
        let mailOptions={
            from:"process.env.ADMIN_EMAIL",
            to:email,
            subject:"Your OTP for Signup",
            text:`Your OTP is ${otp}.it will expire in one minute`
        }

        await transporter.sendMail(mailOptions)
        console.log(`OTP email sent to ${email} : otp - ${otp}`);
    } catch (error) {
        console.log(error.message)
    }
}

module.exports={
    sendOtpByEmail
}