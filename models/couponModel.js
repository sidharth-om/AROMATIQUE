const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed', 'freeship'],
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    minOrder: {
        type: Number,
        default: 0
    },
    minOrderAmount: { // Add this field for compatibility
        type: Number,
        default: 0
    },
    maxDiscount: {
        type: Number
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    expiryDate: { // Add this field for compatibility
        type: Date
    },
    usageLimit: {
        type: Number
    },
    usedCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    userId: { // Add this field for user-specific coupons
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isReferralReward: { // Add this field to identify referral coupons
        type: Boolean,
        default: false
    },
    referralDetails: { // Add referral-specific details
        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        referralDate: {
            type: Date
        }
    }
}, { timestamps: true });

// Static method to generate unique coupon code
couponSchema.statics.generateUniqueCouponCode = async function() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    let code;
    
    while (!isUnique) {
        code = 'REF';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        const existingCoupon = await this.findOne({ code: code });
        if (!existingCoupon) {
            isUnique = true;
        }
    }
    
    return code;
};

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;