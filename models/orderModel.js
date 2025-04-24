const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true }, // UUID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  paymentMethod: { type: String, required: true },
  orderDate: { type: Date, default: Date.now },
  paymentStatus:{ type: String},
  status: { type: String, enum: ["pending", "processing", "shipped","delivered", "cancelled","return request","returned","failed"], default: "pending" },
  address: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      volume: { type: String, required: true }, 
      quantity: { type: Number, required: true, min: 1 },
      itemSalePrice:{type:Number},
      // salePrice: { type: Number, required: true, set: v => parseFloat(v.toFixed(2)) },
      itemStatus: { type: String, enum: ["pending", "processing", "shipped","delivered", "cancelled","return request","returned",], default: "pending" },
      reason:{type:String},
      requestQuantity: { type: Number},
    },
  ],
  transactionId: { type: String },
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
  amountPaid:{ type: Number, },
  total: { type: Number, required: true },
  deliveredDate: { type: Date },
  

  // for return request....
  returnRequest: {
    isRequested: { type: Boolean, default: false }, // Track return requests
    reason: { type: String }, // Reason for return
    requestedAt: { type: Date }, // Timestamp when return was requested
    processedAt: { type: Date }, // When admin processes return
  },

});

module.exports = mongoose.model("Order", orderSchema);