const mongoose = require("mongoose");

  const productSchema = new mongoose.Schema(
    {
      name: { type: String, required: true },
      description: { type: String, },
      offer: {
        type: Number,
        default: 0, // Offer in percentage (0 means no discount)
        min: [0, "Offer cannot be negative"],
        max: [100, "Offer cannot exceed 100%"],
      },
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
      brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },
      images: [String],
      isActive: { type: Boolean, default: true },
      variants: [
        {
          volume: {
            type: String,
            // required: true,
          },
          regularPrice: {
            type: Number,
            // required: true,
            min: [0, "Regular price cannot be negative"],
          },
          
        
          quantity: {
            type: Number,
            // required: true,
            min: [0, "Quantity cannot be negative"],
          },
        },
      ],
    },
    {
      timestamps: true,
      toJSON: { virtuals: true },
      toObject: { virtuals: true },
    }
  );



  module.exports = mongoose.model("Product", productSchema);