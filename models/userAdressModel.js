const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // References the User model
        required: true
    },
    
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,  // Using String to support international formats
        required: true
    },
    pincode: {
        type: String,  // Using String to support leading zeros (e.g., "01234")
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    status: { 
        type: String, 
        enum: ['active', 'blocked'], 
        default: 'active' }
    
});

module.exports = mongoose.model("Address", addressSchema);
