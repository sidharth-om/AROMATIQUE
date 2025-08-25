const express = require("express")
const admin_route = express()
const adminController = require("../controller/admin/adminController")
const productController = require("../controller/admin/productController")
const categoryController = require("../controller/admin/categoryController")
const brandController = require("../controller/admin/brandController")
const customerController = require("../controller/admin/customerController")
const orderController = require("../controller/admin/orderController")
const couponController=require("../controller/admin/couponController")
const dashboardController=require("../controller/admin/dashboardController")
const upload = require("../config/multer")
const { isAdminAuthenticated, isAdminNotAuthenticated } = require("../middlware/adminAuth")
const inventoryController = require("../controller/admin/inventoryController");
const csrf = require("csurf");
const csrfProtection = csrf();

const Category = require("../models/category")
const userProductController = require("../controller/user/userProductController")

// Routes accessible only when admin is NOT logged in
admin_route.get("/adminLogin", isAdminNotAuthenticated, adminController.loadAdminLogin)
admin_route.post("/verifyAdminLogin", isAdminNotAuthenticated, adminController.verifyLogin)

// Routes that require admin authentication
admin_route.get("/loadDashboard", isAdminAuthenticated, dashboardController.loadDashboard)
admin_route.get("/category", isAdminAuthenticated, categoryController.loadCategory)
admin_route.post("/createCategory", isAdminAuthenticated, upload.single("image"), categoryController.createCategory)
admin_route.post("/editCategory/:id", isAdminAuthenticated, upload.single("image"), categoryController.editCategory)
admin_route.get("/brands", isAdminAuthenticated, brandController.loadBrands)
admin_route.post("/addBrand", isAdminAuthenticated, upload.single("image"), brandController.addBrand)
admin_route.post("/editBrand/:id", isAdminAuthenticated, upload.single("image"), brandController.editBrand)
admin_route.get("/products", isAdminAuthenticated, productController.loadProducts)
admin_route.get("/addProduct", isAdminAuthenticated, productController.addProduct)
admin_route.post("/productStatus/:id", isAdminAuthenticated, productController.productStatus)
admin_route.post("/addProducts", isAdminAuthenticated, upload.array("images"), productController.addProducts)
admin_route.get("/getCatagories", isAdminAuthenticated, productController.getCatagories)
admin_route.get("/getBrand", isAdminAuthenticated, productController.getBrand)
admin_route.get("/editProducts/:id", isAdminAuthenticated, productController.loadEditProduct)
admin_route.patch("/editedProducts", isAdminAuthenticated, upload.array("newImages"), productController.editedProducts)
admin_route.delete("/removeImage", isAdminAuthenticated, productController.removeImage)
admin_route.get("/users", isAdminAuthenticated, customerController.loadCustomers)
admin_route.post("/customerStatus/:id", isAdminAuthenticated, customerController.customerStatus)

// ORDER ROUTES - Updated to match frontend expectations
admin_route.get("/orderList", isAdminAuthenticated, orderController.loadOrderList)
admin_route.get("/orders", isAdminAuthenticated, orderController.loadOrderList) // Alternative route for frontend
admin_route.post("/updateStatus", isAdminAuthenticated, orderController.updateStatus)
admin_route.post("/updateItemStatus", isAdminAuthenticated, orderController.updateItemStatus)
admin_route.post("/orders/update-item-status", isAdminAuthenticated, orderController.updateItemStatus) // Frontend expects this route
admin_route.get("/orderDetail", isAdminAuthenticated, orderController.orderDetail)
admin_route.get("/orders/view/:orderId/:itemIndex", isAdminAuthenticated, orderController.viewDetails) // Frontend expects this route

admin_route.get("/logout", adminController.logout)

// COUPON ROUTES - Fixed with proper middleware
admin_route.get("/coupon", isAdminAuthenticated, couponController.loadCoupons)
admin_route.get("/addCoupon", isAdminAuthenticated, couponController.loadAddCoupon)
admin_route.post("/createCoupon", isAdminAuthenticated, couponController.createCoupon)
admin_route.get("/editCoupon/:id", isAdminAuthenticated, couponController.loadEditCoupon)
admin_route.put("/updateCoupon/:id", isAdminAuthenticated, couponController.updateCoupon)
admin_route.patch("/couponStatus/:id", isAdminAuthenticated, couponController.toggleCouponStatus)
admin_route.delete("/deleteCoupon/:id", isAdminAuthenticated, couponController.deleteCoupon)
admin_route.get("/couponDetails/:id", isAdminAuthenticated, couponController.getCouponDetails)

admin_route.get("/inventory", isAdminAuthenticated, csrfProtection, inventoryController.loadInventory);
admin_route.post("/update/:productId", isAdminAuthenticated, csrfProtection, inventoryController.updateStock);

admin_route.get("/salesReport",isAdminAuthenticated,orderController.generateSalesReport)
admin_route.get("/salesReport/download", isAdminAuthenticated, orderController.generateSalesReport)

module.exports = admin_route