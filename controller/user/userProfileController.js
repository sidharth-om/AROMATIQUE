const User = require("../../models/userModel");
const userAddress = require("../../models/userAdressModel");
const Cart=require("../../models/cartModel")
const { sendOtpByEmail } = require("./sendOtp")
const bcrypt=require("bcrypt")


const generateOtpCode=()=>Math.floor(100000 +Math.random() * 900000).toString()

const userProfileController = {
    loadUserProfile: async (req, res) => {
        try {
            const userId = req.session.user?.userId;
            console.log("id:::",userId)
            const user = await User.findById(userId);
            const address=await userAddress.find({userId:userId,status:"active"})
            console.log(("addr",address))
             const cart=await Cart.findOne({userId})
            // console.log("addrra:",address)
            res.render("user/userProfile", { user,address,cart });
        } catch (error) {
            console.log(error.message);
        }
    },

    uploadProfile: async (req, res) => {
        try {
            const image = "/uploads/" + req.file.filename;
            const id = req.session.user.userId;
            await User.findByIdAndUpdate(id, { image: image });

            res.json({ success: true, image });
        } catch (error) {
            console.log(error.message);
        }
    },

    // ADD THIS NEW METHOD
    updateProfile: async (req, res) => {
        try {
            const userId = req.session.user?.userId;
            const { fullname, phoneNumber } = req.body;

            // Validation
            if (!fullname || !phoneNumber) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Please fill all required fields" 
                });
            }

            // Validate fullname (letters, spaces, hyphens, apostrophes, 2-50 characters)
            const nameRegex = /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'-]{2,50}$/;
            if (!nameRegex.test(fullname.trim())) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Name should contain only letters, spaces, hyphens, or apostrophes (2-50 characters)" 
                });
            }

            // Validate phone number (10 digits)
            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(phoneNumber.trim())) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Please enter a valid 10-digit mobile number" 
                });
            }

            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: "User not found" 
                });
            }

            // Update user profile
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    fullname: fullname.trim(),
                    phoneNumber: parseInt(phoneNumber.trim())
                },
                { new: true }
            );

            // Update session data
            req.session.user.fullname = updatedUser.fullname;

            console.log("Profile updated successfully for user:", userId);
            
            return res.status(200).json({ 
                success: true, 
                message: "Profile updated successfully",
                user: {
                    fullname: updatedUser.fullname,
                    phoneNumber: updatedUser.phoneNumber,
                    email: updatedUser.email
                }
            });

        } catch (error) {
            console.log("Error updating profile:", error.message);
            return res.status(500).json({ 
                success: false, 
                message: "Internal server error. Please try again." 
            });
        }
    },

    addAddress: async (req, res) => {
        try {

            res.render("user/addAddress");
        } catch (error) {
            console.log(error.message);
        }
    },

    verifyAddress: async (req, res) => {
        try {
            // console.log("Received Address Data:", req.body);

            const { fullName, address, phone, pincode } = req.body;
            const userId = req.session.user?.userId; // Get the logged-in user ID

            if (!userId) {
                return res.status(401).json({ message: "Unauthorized: Please log in." });
            }

            // Check for empty fields
            if (!fullName.trim() || !address.trim() || !phone.trim() || !pincode.trim()) {
                return res.status(400).json({ message: "Please fill all the fields" });
            }

            // Regular Expressions for validation
            const regexPatterns = {
                nameRegex: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'-]{2,50}$/,
                addressRegex: /^[a-zA-Z0-9\s,.\-\/]{5,}$/,
                phoneRegex: /^[\d]{10,15}$/,
                pincodeRegex: /^[\d]{6}$/
            };

            // Validate inputs
            if (!regexPatterns.nameRegex.test(fullName)) {
                return res.status(400).json({ message: "Name should contain only letters, spaces, hyphens, or apostrophes (2-50 characters)." });
            }
            if (!regexPatterns.addressRegex.test(address)) {
                return res.status(400).json({ message: "Invalid address format." });
            }
            if (!regexPatterns.phoneRegex.test(phone)) {
                return res.status(400).json({ message: "Invalid phone number format." });
            }
            if (!regexPatterns.pincodeRegex.test(pincode)) {
                return res.status(400).json({ message: "Invalid pincode format." });
            }

            // ✅ Create and save the address
            const newAddress = new userAddress({
                userId, // Associate address with user
                name: fullName,
                address: address,
                phoneNumber: phone,
                pincode: pincode
            });

            await newAddress.save(); // Save to DB
            console.log("Address saved successfully");

            return res.status(200).json({ success: true, message: "User address saved successfully",  });

        } catch (error) {
            console.log("Error saving address:", error.message);
            res.status(500).json({ message: "Internal server error" });
        }
    },
    editAddress:async (req,res) => {
        try {
            console.log("hummmmmmmmm")
            const userId = req.session.user?.userId;
            const {addressId}=req.body
            console.log("address:+",addressId)
            console.log("id::::",userId)

            const address=await userAddress.find({userId:userId,_id:addressId})
            console.log("address:+",address)
           res.render("user/editAddress",{address})
        } catch (error) {
            console.log(error.message)
        }
    },
    deleteAddress:async (req,res) => {
        try {
            console.log("Toggle address status request received");
    console.log("Request body:", req.body);
    console.log("Address ID from request:", req.body.addressId);

    const  userId = req.session.user?.userId;
    // const {addressId}=req.body
    const addressId =  req.body.addressId;

 
    const address=await userAddress.findOne({_id:addressId,userId:userId})

    
    if (!address) {
        return res.status(404).json({ success: false, message: 'Address not found or does not belong to you' });
      }

      address.status = address.status === 'active' ? 'blocked' : 'active';
      
   
      await address.save();

       console.log("urr:",address.status)
      return res.status(200).json({ 
          success: true, 
          message: `Address ${address.status === 'active' ? 'unblocked' : 'blocked'} successfully`, 
          status: address.status 
      });
        } catch (error) {
            console.log(error.message)
        }
    },
    updateAddress:async (req,res) => {
        try {
        

            const {fullName,fullAddress,phone,pincode,addressId}=req.body

            console.log("ith req body",fullName,fullAddress,phone,pincode,addressId,)

            if(!fullName.trim()||!fullAddress.trim()||!phone.trim()||!pincode.trim()||!addressId.trim()){
                return res.status(400).json({message:"please fill the fields"})
            }

            const regexPatterns = {
                nameRegex: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s'-]{2,50}$/,
                addressRegex: /^[a-zA-Z0-9\s,.\-\/]{5,}$/,
                phoneRegex : /^\d{10}$/,
                pincodeRegex: /^[\d]{4,10}$/
            };

            // Validate inputs
            if (!regexPatterns.nameRegex.test(fullName)) {
                return res.status(400).json({ message: "Name should contain only letters, spaces, hyphens, or apostrophes (2-50 characters)." });
            }
            if (!regexPatterns.addressRegex.test(fullAddress)) {
                return res.status(400).json({ message: "Invalid address format." });
            }
            if (!regexPatterns.phoneRegex.test(phone)) {
                return res.status(400).json({ message: "Invalid phone number format." });
            }
            if (!regexPatterns.pincodeRegex.test(pincode)) {
                return res.status(400).json({ message: "Invalid pincode format." });
            }


            const updatedData={
                name:fullName,
                address:fullAddress,
                phoneNumber:phone,
                pincode:pincode,
              
            }

            const updatedAddress=await userAddress.findByIdAndUpdate(addressId,{$set:updatedData},{new:true})


            console.log("Address updated successfully",updatedAddress)
            res.json({success:true,message:"Address updated successfully",redirectUrl:"/user/viewProfile"})


        } catch (error) {
            console.log(error.message)
        }
    },
    changeEmailOtp:async (req,res) => {
        try {
            // console.log("chane req:",req.body)
            const {currentEmail,newEmail}=req.body
            console.log("current:",currentEmail,"new:",newEmail)

            const user=await User.findOne({email:currentEmail})

            req.session.changeEmail={
                currentEmail:currentEmail,
                newEmail:newEmail
            }
     

            const otp=generateOtpCode()
            const expiresAt=Date.now() + 60 * 1000
            req.session.otpData={otp,expiresAt}
            console.log(otp)
            await sendOtpByEmail(newEmail,otp)

           
            console.log("otp sended successfully");
            // console.log("userrr:::",user)
            return res.status(200).json({success:true,message:"otp sended successfully"})

        } catch (error) {
            console.log(error.message)
        }
    },
    verifyChangeEmailOtp:async (req,res) => {
        try {
            const {otp}=req.body
            console.log("req.boy",req.body)

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


            const userId=req.session.user.userId
            const newEmail=req.session.changeEmail.newEmail

           

            console.log("iddd:",userId,"curr:",newEmail)

            await User.findByIdAndUpdate(userId,{email:newEmail},{new:true})

            req.session.user.email=newEmail
      

            return res.status(200).json({success:true,message:"successfully changed email"})
           
         
        } catch (error) {
            console.log(error.message)
        }
    },
    changePasswordOtp: async (req, res) => {
        try {
            const { currentPassword, newPassword, confirmPassword } = req.body;
            console.log("naan", currentPassword);
            const email = req.session.user.email;

            // Validate inputs
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({ message: "Please fill all password fields" });
            }

            // Fetch user
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Check if current password matches
            const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordMatch) {
                return res.status(400).json({ message: "Current password is incorrect" });
            }

            // Validate new password and confirm password
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ message: "New password and confirm password must match" });
            }

            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
            if (!passwordRegex.test(newPassword)) {
                return res.status(400).json({
                    message: "New password must be 8-20 characters, include at least one letter, one number, and one special character"
                });
            }

            // Store new password in session
            req.session.changePassword = {
                newPassword: newPassword,
                confirmPassword: confirmPassword
            };

            // Generate and send OTP
            const otp = generateOtpCode();
            const expiresAt = Date.now() + 60 * 1000;
            req.session.otpData = { otp, expiresAt };
            console.log(otp);
            await sendOtpByEmail(email, otp);

            console.log("otp sended successfully");
            return res.status(200).json({ success: true, message: "otp sended successfully" });

        } catch (error) {
            console.log(error.message);
            return res.status(500).json({ message: "Internal server error" });
        }
    }, 
    
    verifyChangePasswordOtp:async (req,res) => {
        try {
            const email= req.session.user.email
             const {passwordOtpCode}=req.body
            //  console.log("hh:",otp)

           

            const newPassword=req.session.changePassword.newPassword
            const confirmPassword=req.session.changePassword.confirmPassword

          if(! req.session.user.email){
            return res.status(400).json({message:"email not found"})
          }

          if(newPassword!==confirmPassword){
            return res.status(400).json({message:"password and confirm password must be same"})
          }
          if(!newPassword.trim()||!confirmPassword.trim()){
            return res.status(400).json({message:"Enter password and New password"})
          }
          if(!passwordOtpCode.trim()){
            return res.status(400).json({message:"Enter otp"})
          }

          const passwordRegex=/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/
          const otpRegex=/^\d{6}$/

          if(!passwordRegex.test(newPassword)||!passwordRegex.test(confirmPassword)){
            return res.status(400).json({message:"Password must be 8-20 characters, include at least one letter, one number, and one special character"})
          }
      
          if(!otpRegex.test(passwordOtpCode)){
            return res.status(400).json({message: "Invalid OTP, it should be a 6-digit number"})
          }

          const user=await User.findOne({email})

          if(!user){
            return res.json({success:false,message:"Invalid or expired OTP"})
          }

            user.password=await bcrypt.hash(newPassword,10)
            user.passwordOtpCode=undefined
            user.expiresAt=undefined
            await user.save()
            
           return res.status(200).json({success:true,message:"Password changed successfully"})
        } catch (error) {
            console.log(error.message)
        }
    },
    loadEditProfile:async (req,res) => {
        try {
             const userId = req.session.user?.userId;
        const user = await User.findById(userId); // Fetch user details from DB
        console.log("edd", user);
         const address=await userAddress.find({userId:userId,status:"active"})
            console.log(("addr",address))
             const cart=await Cart.findOne({userId})

        res.render("user/editProfile", { user,address,cart });
        } catch (error) {
            console.log(error.message)
        }
    }
};

module.exports = userProfileController;