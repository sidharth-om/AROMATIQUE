const mongoose = require("mongoose");

// Function to generate unique referral code
const generateReferralCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

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
    },
    
    // Referral System Fields
    referralCode: {
        type: String,
        unique: true,
        default: generateReferralCode
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referralCount: {
        type: Number,
        default: 0
    },
    referredUsers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        dateReferred: {
            type: Date,
            default: Date.now
        }
    }],
    referralEarnings: {
        type: Number,
        default: 0
    }
},
{timestamps : true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pre-save middleware to ensure referral code is unique
userSchema.pre('save', async function(next) {
    if (this.isNew && !this.referralCode) {
        let isUnique = false;
        while (!isUnique) {
            const code = generateReferralCode();
            const existingUser = await mongoose.model('User').findOne({ referralCode: code });
            if (!existingUser) {
                this.referralCode = code;
                isUnique = true;
            }
        }
    }
    next();
});

module.exports = mongoose.model("User", userSchema);