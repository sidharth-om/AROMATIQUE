const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['cod', 'razorpay', 'wallet']
    },
    orderDate: {
        type: String,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    address: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address", 
        required: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        volume: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        itemSalePrice: {
            type: Number,
            required: true,
            min: 0
        },
        itemStatus: {
            type: String,
            enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return request', 'returned','payment failed'],
            default: 'pending'
        },
        // Additional fields for returns
        reason: {
            type: String,
            default: null
        },
        requestQuantity: {
            type: Number,
            default: null
        },
        returnRequestDate: {
            type: Date,
            default: null
        },
        returnApprovedDate: {
            type: Date,
            default: null
        }
    }],
    
    // Pricing breakdown
    subtotal: {
        type: Number,
        required: true,
        min: 0,
        comment: "Original price before any discounts"
    },
    total: {
        type: Number,
        required: true,
        min: 0,
        comment: "Final amount after all discounts"
    },
    amountPaid: {
        type: Number,
        required: true,
        min: 0,
        comment: "Amount customer actually paid"
    },
    
    // Discount details
    offerDiscount: {
        type: Number,
        default: 0,
        min: 0,
        comment: "Discount from product/category offers"
    },
    systemDiscount: {
        type: Number,
        default: 0,
        min: 0,
        comment: "System discount (e.g., 10% for orders > 2000)"
    },
    couponDiscount: {
        type: Number,
        default: 0,
        min: 0,
        comment: "Discount from applied coupon"
    },
    shipping: {
        type: Number,
        default: 0,
        min: 0,
        comment: "Shipping charges"
    },
    
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned','return rejected','complete'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        required: true
    },
    couponUsed: {
        type: String,
        default: null,
        comment: "Coupon code used for this order"
    },
    razorpayOrderId: String,
razorpayPaymentId: String,
    
    // Return request details
    returnRequest: {
        isRequested: {
            type: Boolean,
            default: false
        },
        reason: {
            type: String,
            default: null
        },
        requestedAt: {
            type: Date,
            default: null
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'completed','failed'],
            default: 'pending'
        }
    },
    
    // Additional fields for order tracking
    estimatedDelivery: {
        type: Date
    },
    actualDelivery: {
        type: Date
    },
    trackingNumber: {
        type: String
    },
    cancelReason: {
        type: String
    },
    returnReason: {
        type: String
    }
    
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for total savings
orderSchema.virtual('totalSavings').get(function() {
    return this.offerDiscount + this.systemDiscount + this.couponDiscount;
});

// Virtual for order value breakdown
orderSchema.virtual('priceBreakdown').get(function() {
    return {
        originalAmount: this.subtotal,
        offerDiscount: this.offerDiscount,
        systemDiscount: this.systemDiscount,
        couponDiscount: this.couponDiscount,
        shipping: this.shipping,
        finalAmount: this.total,
        totalSavings: this.offerDiscount + this.systemDiscount + this.couponDiscount
    };
});

// Virtual to check if order has any return requests
orderSchema.virtual('hasReturnRequests').get(function() {
    return this.items.some(item => item.itemStatus === 'return request');
});

// Virtual to get return eligible items (delivered items that haven't been returned)
orderSchema.virtual('returnEligibleItems').get(function() {
    return this.items.filter(item => 
        item.itemStatus === 'delivered' && 
        !['return request', 'returned'].includes(item.itemStatus)
    );
});

module.exports = mongoose.model("Order", orderSchema);