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
        required: true,
        min: 0
    },
    minOrderAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    maxDiscount: {
        type: Number,
        min: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    usageLimit: {
        type: Number,
        default: 1,
        min: 1
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isReferralReward: {
        type: Boolean,
        default: false
    },
    referralDetails: {
        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        referralDate: {
            type: Date
        }
    }
}, { timestamps: true });

couponSchema.statics.generateUniqueCouponCode = async function() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    let code;

    while (!isUnique) {
        code = 'REF';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        const existingCoupon = await this.findOne({ code });
        if (!existingCoupon) {
            isUnique = true;
        }
    }

    return code;
};

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;