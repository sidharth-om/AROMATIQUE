const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String, 
    required: true, 
  },
  offer: {
    type: Number,
    default: 0,
    min: [0, "Offer cannot be negative"],
    max: [100, "Offer cannot exceed 100%"]
  },
  status: {
    type: Boolean,
    default: true, 
  },
},
{
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model("Category", categorySchema);