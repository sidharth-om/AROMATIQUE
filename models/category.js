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
  regularPrice: {  // ✅ Ensure camelCase
    type: Number,
    default: 0
  },
  offerPrice: {  // ✅ Ensure camelCase
    type: Number,
    default: 0, 
  },
  status: {
    type: Boolean,
    default: true, 
  },
  

},
{timestamps : true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


module.exports = mongoose.model("Category", categorySchema);
