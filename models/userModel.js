const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,  // Ensure unique emails
    },
    password: {
        type: String,
        required: false,  // ✅ Change to optional for Google OAuth users
    },
    fullname: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: Number,
        required: false,  // ✅ Change to optional
    },
    googleId: {
        type: String,
        unique: true, // ✅ Ensure unique Google ID
        sparse: true, // ✅ Allows non-Google users to have null Google ID
    },
    isActive:{
        type:Boolean,
        default:true,
    },
    image: { type: String },

    otp:String,
    expiresAt:Date,
    wallet: {
        balance: {
          type: Number,
          default: 0
        },
        lastUpdated: {
          type: Date,
          default: Date.now
        }
      }
    
},
{timestamps : true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});



module.exports = mongoose.model("User", userSchema);