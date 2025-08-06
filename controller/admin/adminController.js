const Admin=require("../../models/adminModel")
// const category = require("../../models/category")
const Category=require("../../models/category")
const Brand=require("../../models/brandModel")
const bcrypt = require("bcrypt")
const statusCode=require("../../config/statusCode")
const message=require("../../config/adminMessages")


const adminController={
    loadAdminLogin:async (req,res) => {
        try {
            res.render("admin/adminLogin")
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
                return res.status(statusCode.BAD_REQUEST).json({message:message.verifyLoginEmailPasswordRequired})
            }
            if(!regexPatterns.email.test(email)){
                return res.status(statusCode.BAD_REQUEST).json({message:message.verifyLoginEmailInvalid})
            }

            if(!regexPatterns.password.test(password)){
                return res.status(statusCode.BAD_REQUEST).json({message:message.verifyLoginPasswordInvalid})
            }

            const admin=await Admin.findOne({email})

            if(!admin){
                return res.status(statusCode.BAD_REQUEST).json({message:message.verifyLoginAdminNotFound})
            }

            const isPasswordValid = await bcrypt.compare(password,admin.password.trim())
            console.log("ad pass:",admin.password)

            if(!isPasswordValid){
                return res.status(statusCode.BAD_REQUEST).json({message:message.verifyLoginInvalidPassword})
            }

            req.session.admin={
                email:admin.email,
                adminId:admin._id
            }

            return res.status(statusCode.OK).json({success:true,redirectUrl:"/admin/loadDashboard"})

        } catch (error) {
            console.log(error.message)
        }
    },
    loadDashboard:async (req,res) => {
        try {
            res.render("admin/dashboard")
        } catch (error) {
            console.log(error.message)
        }
    },
    logout:async (req,res) => {
        try {
            req.session.admin = null;
    
            // Set cache headers to force a fresh page load
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            
            res.redirect('/admin/adminLogin');
           
        } catch (error) {
            console.log(error.message)
        }
    }
    
    
}

module.exports=adminController