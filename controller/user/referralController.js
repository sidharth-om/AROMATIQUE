const User = require("../../models/userModel")
const Coupon = require("../../models/couponModel")
const Order = require("../../models/orderModel")

const referralController = {
    // Load referral page with user data and referral coupons
    loadRefferal: async (req, res) => {
        try {
            const userId = req.session.user.userId
            
            // Get user details with populated referral data
            const userDetails = await User.findById(userId)
                .populate({
                    path: 'referredUsers.user',
                    select: 'fullname email createdAt'
                })
            
            // Get referral reward coupons for this user
            const referralCoupons = await Coupon.find({
                userId: userId,
                isReferralReward: true,
                isActive: true
            }).populate('referralDetails.referredUser', 'fullname email')
            
            console.log("User Details:", userDetails)
            console.log("Referral Coupons:", referralCoupons)
            
            res.render("user/referralPage", { 
                userDetails, 
                referralCoupons 
            })
        } catch (error) {
            console.log("Error in loadRefferal:", error.message)
            res.status(500).render("error", { message: "Error loading referral page" })
        }
    },

    // Apply referral code during user registration
    applyReferralCode: async (referralCode, newUserId) => {
        try {
            if (!referralCode || !newUserId) {
                return { success: false, message: "Missing referral code or user ID" }
            }

            // Find the referrer by referral code
            const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() })
            
            if (!referrer) {
                return { success: false, message: "Invalid referral code" }
            }

            if (referrer._id.toString() === newUserId.toString()) {
                return { success: false, message: "Cannot use your own referral code" }
            }

            // Update the new user with referrer information
            const newUser = await User.findByIdAndUpdate(
                newUserId, 
                { referredBy: referrer._id },
                { new: true }
            )

            if (!newUser) {
                return { success: false, message: "New user not found" }
            }

            // Update referrer's referral count and add to referred users list
            await User.findByIdAndUpdate(referrer._id, {
                $inc: { referralCount: 1 },
                $push: {
                    referredUsers: {
                        user: newUserId,
                        dateReferred: new Date()
                    }
                }
            })

            // Create referral reward coupon for the referrer
            const couponCode = await Coupon.generateUniqueCouponCode()
            
            const referralCoupon = new Coupon({
                code: couponCode,
                description: `Referral reward for inviting ${newUser.fullname}`,
                type: 'percentage',
                value: 10, // 10% discount
                minOrder: 500, // Minimum order of ₹500
                minOrderAmount: 500, // For compatibility
                maxDiscount: 200, // Maximum discount of ₹200
                startDate: new Date(),
                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Valid for 90 days
                expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // For compatibility
                usageLimit: 1,
                isActive: true,
                userId: referrer._id,
                isReferralReward: true,
                referralDetails: {
                    referredUser: newUserId,
                    referralDate: new Date()
                }
            })

            await referralCoupon.save()

            // Create welcome coupon for the new user
            const welcomeCouponCode = await Coupon.generateUniqueCouponCode()
            
            const welcomeCoupon = new Coupon({
                code: welcomeCouponCode,
                description: `Welcome bonus for joining through referral`,
                type: 'percentage',
                value: 5, // 5% discount
                minOrder: 300, // Minimum order of ₹300
                minOrderAmount: 300,
                maxDiscount: 100, // Maximum discount of ₹100
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Valid for 30 days
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                usageLimit: 1,
                isActive: true,
                userId: newUserId,
                isReferralReward: true,
                referralDetails: {
                    referredUser: newUserId,
                    referralDate: new Date()
                }
            })

            await welcomeCoupon.save()

            return {
                success: true,
                message: "Referral applied successfully",
                referrerCoupon: couponCode,
                newUserCoupon: welcomeCouponCode
            }

        } catch (error) {
            console.log("Error in applyReferralCode:", error.message)
            return { success: false, message: "Error processing referral" }
        }
    },

    // Validate referral code (AJAX endpoint)
    validateReferralCode: async (req, res) => {
        try {
            console.log("ith referralll")
            const { referralCode } = req.body
            
            if (!referralCode) {
                return res.json({ success: false, message: "Referral code is required" })
            }

            const referrer = await User.findOne({ 
                referralCode: referralCode.toUpperCase() 
            }).select('fullname referralCode')
            
            if (!referrer) {
                return res.json({ success: false, message: "Invalid referral code" })
            }

            return res.json({ 
                success: true, 
                message: `Valid referral code from ${referrer.fullname}`,
                referrerName: referrer.fullname
            })

        } catch (error) {
            console.log("Error in validateReferralCode:", error.message)
            return res.json({ success: false, message: "Error validating referral code" })
        }
    },

    // Get referral statistics (AJAX endpoint)
    getReferralStats: async (req, res) => {
        try {
            const userId = req.session.user.userId
            
            const user = await User.findById(userId)
                .populate('referredUsers.user', 'fullname email createdAt')
            
            const referralCoupons = await Coupon.find({
                userId: userId,
                isReferralReward: true,
                isActive: true
            })

            // Calculate total savings from referral coupons used
            const usedReferralCoupons = await Order.find({
                userId: userId,
                couponUsed: { $in: referralCoupons.map(c => c.code) }
            })

            const totalSavings = usedReferralCoupons.reduce((sum, order) => {
                return sum + (order.couponDiscount || 0)
            }, 0)

            return res.json({
                success: true,
                stats: {
                    totalReferrals: user.referralCount || 0,
                    activeCoupons: referralCoupons.length,
                    totalSavings: totalSavings,
                    referralCode: user.referralCode
                }
            })

        } catch (error) {
            console.log("Error in getReferralStats:", error.message)
            return res.json({ success: false, message: "Error getting referral stats" })
        }
    },

    // Process referral completion (called when referred user makes first purchase)
    processReferralCompletion: async (userId, orderId) => {
        try {
            const user = await User.findById(userId)
            
            if (!user || !user.referredBy) {
                return { success: false, message: "User not found or not referred" }
            }

            // Check if this is the user's first successful order
            const previousOrders = await Order.countDocuments({
                userId: userId,
                status: { $in: ['delivered', 'completed'] },
                _id: { $ne: orderId }
            })

            if (previousOrders > 0) {
                return { success: false, message: "Not the first order" }
            }

            // Update referrer's earnings
            const referrer = await User.findById(user.referredBy)
            if (referrer) {
                const bonusAmount = 50 // ₹50 bonus for successful referral
                
                await User.findByIdAndUpdate(referrer._id, {
                    $inc: { 
                        'wallet.balance': bonusAmount,
                        referralEarnings: bonusAmount
                    },
                    $set: { 'wallet.lastUpdated': new Date() }
                })

                // Create additional bonus coupon for referrer
                const bonusCouponCode = await Coupon.generateUniqueCouponCode()
                
                const bonusCoupon = new Coupon({
                    code: bonusCouponCode,
                    description: `Bonus reward - ${user.fullname} completed first purchase`,
                    type: 'fixed',
                    value: 100, // ₹100 fixed discount
                    minOrder: 1000,
                    minOrderAmount: 1000,
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
                    expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                    usageLimit: 1,
                    isActive: true,
                    userId: referrer._id,
                    isReferralReward: true,
                    referralDetails: {
                        referredUser: userId,
                        referralDate: new Date()
                    }
                })

                await bonusCoupon.save()

                return {
                    success: true,
                    message: "Referral completion processed",
                    bonusAmount: bonusAmount,
                    bonusCoupon: bonusCouponCode
                }
            }

            return { success: false, message: "Referrer not found" }

        } catch (error) {
            console.log("Error in processReferralCompletion:", error.message)
            return { success: false, message: "Error processing referral completion" }
        }
    }
}

module.exports = referralController