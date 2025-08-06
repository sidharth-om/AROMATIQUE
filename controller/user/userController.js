const User = require("../../models/userModel");
const Product = require("../../models/productModel");
const Brand = require("../../models/brandModel");
const Categories = require("../../models/category");
const Cart = require("../../models/cartModel");
const Coupon = require("../../models/couponModel");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { sendOtpByEmail } = require("./sendOtp");
const express = require("express");
const session = require("express-session");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client("142815468591-rc6ar61c1r1sd4sm1nsv0h5cos2r6hk6.apps.googleusercontent.com");
const statusCode=require("../../config/statusCode")
const message=require("../../config/userMessages")

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Function to create referral reward coupon
const createReferralRewardCoupon = async (referrerUserId, referredUser) => {
    try {
        const couponCode = await Coupon.generateUniqueCouponCode();
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3);

        const newCoupon = new Coupon({
            code: couponCode,
            type: 'percentage',
            value: 10,
            minOrderAmount: 500,
            maxDiscount: 200,
            startDate: startDate,
            endDate: endDate, // Changed from expiryDate to endDate
            userId: referrerUserId,
            description: `Referral reward for referring ${referredUser.fullname}`,
            isReferralReward: true,
            referralDetails: {
                referredUser: referredUser._id,
                referralDate: new Date()
            },
            usageLimit: 1,
            usedCount: 0,
            isActive: true
        });

        await newCoupon.save();
        console.log("Created referral coupon:", newCoupon);
        return newCoupon;
    } catch (error) {
        console.error("Error creating referral coupon:", error);
        throw error;
    }
};

const userController = {

loadLandingPage:async (req,res) => {
    try {
          const products = await Product.find().populate("categoryId", "name").populate("brand", "name").limit(4);
            const brands = await Brand.find().limit(4);
            const categories = await Categories.find({}).limit(4);
       
        res.render("user/landingPage",{products,brands,categories})
    } catch (error) {
        console.log(error.message)
    }
},


    loadRegisterPage: async (req, res) => {
        try {
            res.render("user/signup");
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', { message: message.loadRegisterPageGeneralError });
        }
    },

    verifyRegister: async (req, res) => {
        try {
            const { fullname, email, password, phone, confirmPassword, referralCode } = req.body;
            console.log("verify register req.body", req.body);

            const regexPatterns = {
                fullname: /^[A-Za-z\s]{3,50}$/,
                email: /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/,
                phone: /^[1-9]\d{9}$/
            };

            if (!fullname?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterFullnameRequired });
            } else if (!regexPatterns.fullname.test(fullname)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterFullnameInvalid });
            }
            if (!email?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterEmailRequired });
            } else if (!regexPatterns.email.test(email)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterEmailInvalid });
            }
            if (!phone?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterPhoneRequired });
            } else if (!regexPatterns.phone.test(phone)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterPhoneInvalid });
            }
            if (!password?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterPasswordRequired });
            } else if (!regexPatterns.password.test(password)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterPasswordInvalid});
            }
            if (password !== confirmPassword) {
                return res.status(statusCode.BAD_REQUEST).json({ message:message.verifyRegisterPasswordMismatch });
            }

            // Validate referral code if provided
            let referrerUser = null;
            if (referralCode?.trim()) {
                referrerUser = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
                if (!referrerUser) {
                    return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterInvalidReferralCode });
                }
                if (referrerUser.email === email) {
                    return res.status(statusCode.BAD_REQUEST).json({ message:message.verifyRegisterOwnReferralCode });
                }
            }

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyRegisterUserExists });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            req.session.name = fullname;
            req.session.phone = phone;
            req.session.email = email;
            req.session.password = hashedPassword;
            req.session.referrerUserId = referrerUser ? referrerUser._id : null;

            const otp = generateOtpCode();
            
 console.log("oooo",otp)
            const expiresAt = Date.now() + 60 * 1000;
            req.session.otpData = { otp, expiresAt };
            await sendOtpByEmail(email, otp);
           

            return res.status(statusCode.OK).json({ success: true, redirectUrl: "/user/enterOtp" });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message:message.verifyRegisterGeneralError });
        }
    },

    loadOtpPage: async (req, res) => {
        try {
            res.render("user/otp");
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', { message: message.loadOtpPageGeneralError});
        }
    },

    verifyOtp: async (req, res) => {
        try {
            const { otp } = req.body;
            const otpRegex = /^\d{6}$/;

            if (!otp?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message:message.verifyOtpRequired });
            } else if (!otpRegex.test(otp)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyOtpInvalid });
            }

            const storedOtpData = req.session.otpData;
            if (!storedOtpData) {
                return res.status(statusCode.BAD_REQUEST).json({ message:message.verifyOtpNotFound });
            }

            const { otp: storedOtp, expiresAt } = storedOtpData;
            if (Date.now() > expiresAt) {
                delete req.session.otpData;
                return res.status(statusCode.BAD_REQUEST).json({ message:message.verifyOtpExpired });
            }

            if (otp !== storedOtp) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyOtpIncorrect });
            }

            delete req.session.otpData;

            const newUser = new User({
                email: req.session.email,
                password: req.session.password,
                fullname: req.session.name,
                phoneNumber: req.session.phone,
                referredBy: req.session.referrerUserId || null
            });

            await newUser.save();

            if (req.session.referrerUserId) {
                try {
                    const referrerUser = await User.findById(req.session.referrerUserId);
              if (req.session.referrerUserId) {
    const referrerUser = await User.findById(req.session.referrerUserId);
    if (referrerUser) {
        referrerUser.referralCount += 1;
        referrerUser.referredUsers.push({ user: newUser._id, dateReferred: new Date() });
        await referrerUser.save();

        const coupon = await createReferralRewardCoupon(referrerUser._id, newUser);
        console.log(`Referral coupon ${coupon.code} created for ${referrerUser.fullname}`);
    }
}

                } catch (referralError) {
                    console.error("Error processing referral reward:", referralError);
                }
            }

            delete req.session.referrerUserId;
            delete req.session.name;
            delete req.session.phone;
            delete req.session.email;
            delete req.session.password;

            return res.status(statusCode.OK).json({ success: true, redirectUrl: "/user/userLogin" });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.verifyOtpGeneralError });
        }
    },

    resendOtp: async (req, res) => {
        try {
            const email = req.session.email;
            if (!email) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.resendOtpNoEmail });
            }
            const otp = generateOtpCode();
            const expiresAt = Date.now() + 60 * 1000;
            req.session.otpData = { otp, expiresAt };
            await sendOtpByEmail(email, otp);
            return res.status(statusCode.OK).json({ message:message.resendOtpSuccess });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.resendOtpGeneralError });
        }
    },

    loadUserLogin: async (req, res) => {
        try {
            res.render("user/userlogin");
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', { message: message.loadUserLoginGeneralError });
        }
    },

    verifyLogin: async (req, res) => {
        try {
            const { email, password } = req.body;
            const regexPatterns = {
                email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/,
            };

            if (!email?.trim() || !password?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyLoginEmailPasswordRequired });
            }
            if (!regexPatterns.email.test(email)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyLoginEmailInvalid});
            }
            if (!regexPatterns.password.test(password)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyLoginPasswordInvalid });
            }

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyLoginUserNotFound });
            }
            if (!user.isActive) {
                return res.status(statusCode.BAD_REQUEST).json({ message:message.verifyLoginBlockedUser });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.verifyLoginInvalidPassword });
            }

            req.session.user = {
                fullname: user.fullname,
                userId: user._id,
                isActive: user.isActive,
                email: user.email
            };

            return res.status(statusCode.OK).json({ success: true, redirectUrl: "/user/userHome" });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.verifyLoginGeneralError });
        }
    },

    loadUserHome: async (req, res) => {
        try {
            const user = req.session.user;
            const userId = req.session.user.userId;
            const products = await Product.find().populate("categoryId", "name").populate("brand", "name").limit(4);
            const brands = await Brand.find().limit(4);
            const categories = await Categories.find({}).limit(4);
            let cart = await Cart.findOne({ userId });
            if (!cart) {
                cart = { items: [] };
            }
            res.render("user/userHome", { user, products, brands, categories, cart });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', { message: message.loadUserHomeGeneralError });
        }
    },

    loadReferralPage: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect('/user/userLogin');
            }

            const userId = req.session.user.userId;
            const user = await User.findById(userId)
                .populate('referredUsers.user', 'fullname email createdAt')
                .exec();

            const referralCoupons = await Coupon.find({
                userId: userId,
                isReferralReward: true
            }).populate('referralDetails.referredUser', 'fullname email').sort({ createdAt: -1 });

            res.render('user/referral', {
                user: req.session.user,
                userDetails: user,
                referralCoupons
            });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', { message: message.loadReferralPageGeneralError });
        }
    },

    checkReferralCode: async (req, res) => {
        try {
            const { referralCode } = req.body;
            if (!referralCode?.trim()) {
                return res.json({ valid: false, message: message.checkReferralCodeRequired });
            }

            const referrerUser = await User.findOne({ 
                referralCode: referralCode.trim().toUpperCase() 
            });

            if (!referrerUser) {
                return res.json({ valid: false, message: message.checkReferralCodeInvalid });
            }

            return res.json({ 
                valid: true, 
                message: `Valid referral code from ${referrerUser.fullname}`,
                referrerName: referrerUser.fullname 
            });
        } catch (error) {
            console.error(error.message);
            res.json({ valid: false, message: message.checkReferralCodeGeneralError });
        }
    },

    googleLogin: async (req, res) => {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(statusCode.BAD_REQUEST).json({ success: false, message:message.googleLoginTokenRequired });
            }

            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: "142815468591-rc6ar61c1r1sd4sm1nsv0h5cos2r6hk6.apps.googleusercontent.com"
            });

            const payload = ticket.getPayload();
            const { email, name, picture } = payload;

            let user = await User.findOne({ email });
            if (!user) {
                user = new User({ email, fullname: name, image: picture, googleId: payload.sub });
                await user.save();
            }

            req.session.user = {
                fullname: user.fullname,
                userId: user._id,
                isActive: user.isActive,
                email: user.email
            };
            return res.status(statusCode.OK).json({ success: true, message: message.googleLoginSuccess, redirectUrl: "/user/userHome" });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.googleLoginGeneralError});
        }
    },

    loadForgotPassword: async (req, res) => {
        try {
            res.render("user/forgot");
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', { message: message.loadForgotPasswordGeneralError });
        }
    },

    sendForgotOtp: async (req, res) => {
        try {
            const { email } = req.body;
            const user = await User.findOne({ email });
            if (!user) {
                return res.json({ success: false, message: message.sendForgotOtpUserNotFound });
            }

            const otp = generateOtpCode();
            const expiresAt = Date.now() + 5 * 60 * 1000;
            req.session.userEmail = email;
            user.otp = otp;
            user.expiresAt = expiresAt;
            await user.save();
            await sendOtpByEmail(email, otp);

            console.log("forgot otp",otp)

            res.json({ success: true, message: message.sendForgotOtpSuccess });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.sendForgotOtpGeneralError });
        }
    },

    loadResetPassword: async (req, res) => {
        try {
            res.render("user/resetPassword");
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', { message: message.loadResetPasswordGeneralError });
        }
    },

    enterNewPassword: async (req, res) => {
        try {
            const { email, otp, newPassword, confirmPassword } = req.body;
            if (!req.session.userEmail) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.enterNewPasswordEmailNotFound });
            }

            if (newPassword !== confirmPassword) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.enterNewPasswordMismatch});
            }

            if (!newPassword?.trim() || !confirmPassword?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.enterNewPasswordRequired });
            }

            if (!otp?.trim()) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.enterNewPasswordOtpRequired });
            }

            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
            const otpRegex = /^\d{6}$/;

            if (!passwordRegex.test(newPassword) || !passwordRegex.test(confirmPassword)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.enterNewPasswordInvalid });
            }

            if (!otpRegex.test(otp)) {
                return res.status(statusCode.BAD_REQUEST).json({ message: message.enterNewPasswordOtpInvalid });
            }

            const user = await User.findOne({ email: req.session.userEmail });
            if (!user || user.otp !== otp || Date.now() > user.expiresAt) {
                return res.json({ success: false, message: message.enterNewPasswordOtpInvalidOrExpired });
            }

            user.password = await bcrypt.hash(newPassword, 10);
            user.otp = undefined;
            user.expiresAt = undefined;
            await user.save();

            res.json({ success: true, redirectUrl: '/user/userLogin' });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.enterNewPasswordGeneralError });
        }
    },

    logout: async (req, res) => {
        try {
            req.session.destroy();
            return res.status(statusCode.OK).json({ redirectUrl: "/userLogin" });
        } catch (error) {
            console.error(error.message);
            res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.logoutGeneralError});
        }
    }
};

module.exports = userController;