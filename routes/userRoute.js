const express = require("express")
const userRoute = express()
const passport = require("passport")
const userController = require("../controller/user/userController")
const userProductController = require("../controller/user/userProductController")
const userProfileController = require("../controller/user/userProfileController")
const cartController = require("../controller/user/cartController")
const checkoutController = require("../controller/user/checkoutController")
const orderController = require("../controller/user/orderController")
const walletController = require("../controller/user/walletController")
const wishlistController = require("../controller/user/wishlistController")
const { isAuthenticated, isNotAuthenticated } = require("../middlware/userAuth")
const upload = require("../config/multer")
require("../config/passport")

// Routes that should be accessible only when NOT logged in
userRoute.get("/signup", isNotAuthenticated, userController.loadRegisterPage)
userRoute.post("/verifyRegister", isNotAuthenticated, userController.verifyRegister)
userRoute.get("/enterOtp", isNotAuthenticated, userController.loadOtpPage)
userRoute.post("/verifyOtp", isNotAuthenticated, userController.verifyOtp)
userRoute.post("/resendOtp", isNotAuthenticated, userController.resendOtp)
userRoute.get("/userLogin", isNotAuthenticated, userController.loadUserLogin)
userRoute.post("/verifyLogin", isNotAuthenticated, userController.verifyLogin)
userRoute.get("/forgotPassword", isNotAuthenticated, userController.loadForgotPassword)
userRoute.post("/sendForgotOtp", isNotAuthenticated, userController.sendForgotOtp)
userRoute.get("/resetPassword", isNotAuthenticated, userController.loadResetPassword)
userRoute.post("/enterNewPassword", isNotAuthenticated, userController.enterNewPassword)
userRoute.post("/googleLogin", isNotAuthenticated, userController.googleLogin)

// Routes that require authentication
userRoute.get("/userHome", isAuthenticated, userController.loadUserHome)
userRoute.get("/productView/:id", userProductController.productView)
userRoute.get("/shopping", userProductController.loadShopping)
userRoute.get("/viewProfile", isAuthenticated, userProfileController.loadUserProfile)
userRoute.post("/uploadProfile", isAuthenticated, upload.single("image"), userProfileController.uploadProfile)
userRoute.get("/addAddress", isAuthenticated, userProfileController.addAddress)
userRoute.post("/verifyAddress", isAuthenticated, userProfileController.verifyAddress)
userRoute.delete("/logout", userController.logout)
userRoute.post("/editAddress", isAuthenticated, userProfileController.editAddress)
userRoute.put("/deleteAddress", isAuthenticated, userProfileController.deleteAddress)
userRoute.post("/updateAddress", isAuthenticated, userProfileController.updateAddress)
userRoute.post("/changeEmailOtp", isAuthenticated, userProfileController.changeEmailOtp)
userRoute.post("/verifyChangeEmailOtp", isAuthenticated, userProfileController.verifyChangeEmailOtp)
userRoute.post("/changePasswordOtp", isAuthenticated, userProfileController.changePasswordOtp)
userRoute.post("/verifyChangePasswordOtp", isAuthenticated, userProfileController.verifyChangePasswordOtp)

// Cart routes
userRoute.get("/cart", isAuthenticated, cartController.loadCart)
userRoute.post("/addtoCart/:id", isAuthenticated, cartController.addtoCart)
userRoute.delete("/deleteCart/:id", isAuthenticated, cartController.deleteCart)
userRoute.put("/updateCartQuantity", isAuthenticated, cartController.updateCartQuantity)

// Checkout routes
userRoute.get("/checkout", isAuthenticated, checkoutController.loadCheckout)
userRoute.get("/checkoutEditAddress/:id", isAuthenticated, checkoutController.checkoutEditAddress)
userRoute.put("/checkoutDeleteAddress", isAuthenticated, checkoutController.checkoutDeleteAddress)
userRoute.post("/placeOrder", isAuthenticated, checkoutController.placeOrder)
userRoute.get("/orderSuccessful", isAuthenticated, checkoutController.orderSuccessful)
userRoute.get("/orderDetails", isAuthenticated, checkoutController.orderDetails)

// Order routes
userRoute.get("/myOrders", isAuthenticated, orderController.myOrders)
userRoute.get("/orders/:orderId/item/:itemIndex", isAuthenticated, orderController.viewOrder)
userRoute.post("/cancelOrder/:orderId", isAuthenticated, orderController.cancelOrder)
userRoute.post("/cancelEntireOrder/:orderId", isAuthenticated, orderController.cancelEntireOrder)
userRoute.post("/returnRequest", isAuthenticated, orderController.returnRequest)
userRoute.get("/invoice/:orderId/:itemId?", isAuthenticated, orderController.generateInvoice)

// Wishlist routes
userRoute.post("/addtoWishlist/:productId", isAuthenticated, wishlistController.addtoWishlist)
userRoute.get("/wishlist", isAuthenticated, wishlistController.loadWishlist)
userRoute.post("/removeFromWishlist/:productId", isAuthenticated, wishlistController.removeFromWishlist)

// Wallet routes
userRoute.get("/wallet", isAuthenticated, walletController.wallet)

// OAuth routes
userRoute.get("/auth/google", passport.authenticate("google", {scope: ["profile", "email"]}))
userRoute.get("/auth/google/callback", passport.authenticate("google", {
    successRedirect: "/user/userHome",
    failureRedirect: "/user/userLogin"
}))

userRoute.post("/auth/googleLogin", async (req, res) => {
    try {
        const { credential } = req.body;
        console.log("Google Credential Received:", credential);
        // You would verify and create a session for the user here
        return res.json({ success: true, redirectUrl: "/user/userHome" });
    } catch (error) {
        return res.json({ success: false, message: "Google Authentication Failed" });
    }
});

module.exports = userRoute