const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String, // Store the image path or URL
        required: true
    },
    status: {
        type: String,
        enum: ["Active", "Blocked"], // Only allow these values
        default: "Active"
    }
}, { timestamps: true });

const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;
