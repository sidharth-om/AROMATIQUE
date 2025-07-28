const Cart = require("../../models/cartModel")
const User = require("../../models/userModel")
const userAddress = require("../../models/userAdressModel")
const Order = require("../../models/orderModel")
const Product = require("../../models/productModel")
const Coupon = require("../../models/couponModel")
const WalletTransaction = require("../../models/walletTransactionModel")
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const checkoutController = {
    loadCheckout: async (req, res) => {
        try {
            const email = req.session.user.email;
            const userId = req.session.user.userId;
            
            // Get cart with populated product details
            const cart = await Cart.findOne({ userId })
                .populate({
                    path: "items.productId",
                    populate: {
                        path: "categoryId",
                        model: "Category"
                    }
                });
            
            // Check if cart is empty
            if (!cart || !cart.items || cart.items.length <= 0) {
                return res.redirect('/user/cart?message=Your cart is empty. Please add items before checkout.');
            }

            // Stock Validation
            for (let item of cart.items) {
                const product = item.productId;
                if (!product) {
                    return res.redirect('/user/cart?message=Product not found.');
                }
                
                const variant = product.variants.find(v => v.volume === item.volume);
                
                if (!variant) {
                    return res.redirect('/user/cart?message=Product variant not found.');
                }

                if (item.quantity > variant.quantity) {
                    return res.redirect(`/user/cart?message=Insufficient stock for ${product.name} (${variant.volume}). Available: ${variant.quantity}`);
                }
            }
            
            // Get user and address details
            const user = await User.findOne({ email: email });
            const address = await userAddress.find({ userId: userId, status: "active" });
            
            // Get general coupons (not user-specific)
            const generalCoupons = await Coupon.find({
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                userId: null
            });

            // Get referral coupons for the logged-in user
            const referralCoupons = await Coupon.find({
                isActive: true,
                userId: userId,
                isReferralReward: true,
                usedCount: { $lt: 1 },
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            });

            // Merge general and referral coupons
            const allAvailableCoupons = [...generalCoupons, ...referralCoupons];
            
            // Get wallet balance
            const walletTransaction = await WalletTransaction.findOne({ userId }).sort({ createdAt: -1 });
            const walletBalance = walletTransaction ? walletTransaction.wallet.balance : 0;

            let subtotal = 0;
            let discountedSubtotal = 0;
            
            // Calculate prices with discounts
            cart.items.forEach((item) => {
                const product = item.productId;
                const variant = product.variants.find(v => v.volume === item.volume);
                
                if (variant) {
                    const regularPrice = variant.regularPrice;
                    const productOffer = product.offer || 0;
                    const categoryOffer = product.categoryId?.offer || 0;
                    
                    // Apply the higher discount
                    const maxOffer = Math.max(productOffer, categoryOffer);
                    const discountAmount = maxOffer > 0 ? (regularPrice * maxOffer / 100) : 0;
                    const discountedPrice = regularPrice - discountAmount;
                    
                    // Add to totals
                    subtotal += regularPrice * item.quantity;
                    discountedSubtotal += discountedPrice * item.quantity;
                }
            });
            
            // Format the subtotals properly
            subtotal = Math.round(subtotal);
            discountedSubtotal = Math.round(discountedSubtotal);
            
            // Calculate shipping fee
            let shipping = 0;
            if (discountedSubtotal < 1000) {
                shipping = 40;
            }

            // Get applied coupon discount from session
            let appliedCouponDiscount = 0;
            let appliedCouponCode = null;
            if (req.session.appliedCoupon) {
                appliedCouponDiscount = req.session.appliedCoupon.discount || 0;
                appliedCouponCode = req.session.appliedCoupon.code;
            }

            // Calculate final total
            const total = discountedSubtotal + shipping - appliedCouponDiscount;

            res.render("user/checkout", { 
                cart, 
                address, 
                subtotal, 
                discountedSubtotal,
                total, 
                shipping, 
                user,
                availableCoupons: allAvailableCoupons,
                appliedCoupon: req.session.appliedCoupon || null,
                walletBalance
            });
        } catch (error) {
            console.log(error.message);
            res.redirect('/user/cart?message=An error occurred. Please try again.');
        }
    },

    checkoutEditAddress: async (req, res) => {
        try {
            const userId = req.session.user?.userId;
            const addressId = req.params.id;
            const address = await userAddress.find({ userId: userId, _id: addressId });
            res.render("user/editAddress", { address });
        } catch (error) {
            console.log(error.message);
        }
    },

    checkoutDeleteAddress: async (req, res) => {
        try {
            const userId = req.session.user?.userId;
            const addressId = req.body.addressId;
    
            const address = await userAddress.findOne({ _id: addressId, userId: userId });
    
            if (!address) {
                return res.status(404).json({ success: false, message: 'Address not found or does not belong to you' });
            }

            address.status = address.status === 'active' ? 'blocked' : 'active';
            await address.save();

            return res.status(200).json({ 
                success: true, 
                message: `Address ${address.status === 'active' ? 'unblocked' : 'blocked'} successfully`, 
                status: address.status 
            });
        } catch (error) {
            console.log(error.message);
        }
    },

    validateCoupon: async (req, res) => {
        try {
            const { couponCode } = req.body;
            const userId = req.session.user.userId;
            
            // Find the coupon
            const coupon = await Coupon.findOne({ 
                code: couponCode.toUpperCase(),
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            });
            
            if (!coupon) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired coupon code'
                });
            }
            
            // Get cart total to check minimum order requirements
            const cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: {
                    path: "categoryId",
                    model: "Category"
                }
            });
            
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Your cart is empty'
                });
            }
            
            // Calculate cart subtotal with existing discounts
            let discountedSubtotal = 0;
            
            cart.items.forEach((item) => {
                const product = item.productId;
                const variant = product.variants.find(v => v.volume === item.volume);
                
                if (variant) {
                    const regularPrice = variant.regularPrice;
                    const productOffer = product.offer || 0;
                    const categoryOffer = product.categoryId?.offer || 0;
                    
                    const maxOffer = Math.max(productOffer, categoryOffer);
                    const discountAmount = maxOffer > 0 ? (regularPrice * maxOffer / 100) : 0;
                    const discountedPrice = regularPrice - discountAmount;
                    
                    discountedSubtotal += discountedPrice * item.quantity;
                }
            });
            
            discountedSubtotal = Math.round(discountedSubtotal);
            
            // Check if cart total meets minimum order requirement
            if (discountedSubtotal < coupon.minOrder) {
                return res.status(400).json({
                    success: false,
                    message: `This coupon requires a minimum order of ₹${coupon.minOrder}`
                });
            }
            
            // Check if user has already used this coupon
            const hasUsedCoupon = await Order.findOne({ userId, couponUsed: couponCode.toUpperCase() });
            if (hasUsedCoupon) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already used this coupon'
                });
            }
            
            // Calculate discount
            let couponDiscount = 0;
            let shipping = discountedSubtotal < 1000 ? 40 : 0;
            
            if (coupon.type === 'percentage') {
                couponDiscount = discountedSubtotal * (coupon.value / 100);
                if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                    couponDiscount = coupon.maxDiscount;
                }
            } else if (coupon.type === 'fixed') {
                couponDiscount = coupon.value;
            } else if (coupon.type === 'freeship') {
                couponDiscount = shipping;
            }
            
            couponDiscount = Math.round(couponDiscount);
            
            // Store coupon info in session
            req.session.appliedCoupon = {
                code: coupon.code,
                discount: couponDiscount,
                type: coupon.type,
                description: coupon.description
            };
            
            const newTotal = discountedSubtotal + shipping - couponDiscount;
            
            return res.status(200).json({
                success: true,
                message: 'Coupon applied successfully',
                couponDiscount: couponDiscount,
                couponType: coupon.type,
                couponDescription: coupon.description,
                newTotal: newTotal,
                shipping: shipping
            });
        } catch (error) {
            console.log(error.message);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while validating the coupon'
            });
        }
    },

    removeCoupon: async (req, res) => {
        try {
            const userId = req.session.user.userId;
            
            const cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: {
                    path: "categoryId",
                    model: "Category"
                }
            });
            
            if (!cart) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart not found'
                });
            }
            
            let discountedSubtotal = 0;
            cart.items.forEach((item) => {
                const product = item.productId;
                const variant = product.variants.find(v => v.volume === item.volume);
                
                if (variant) {
                    const regularPrice = variant.regularPrice;
                    const productOffer = product.offer || 0;
                    const categoryOffer = product.categoryId?.offer || 0;
                    
                    const maxOffer = Math.max(productOffer, categoryOffer);
                    const discountAmount = maxOffer > 0 ? (regularPrice * maxOffer / 100) : 0;
                    const discountedPrice = regularPrice - discountAmount;
                    
                    discountedSubtotal += discountedPrice * item.quantity;
                }
            });
            
            discountedSubtotal = Math.round(discountedSubtotal);
            
            let shipping = discountedSubtotal < 1000 ? 40 : 0;
            const newTotal = discountedSubtotal + shipping;
            
            req.session.appliedCoupon = null;
            
            return res.status(200).json({
                success: true,
                message: 'Coupon removed successfully',
                newTotal: newTotal,
                shipping: shipping
            });
        } catch (error) {
            console.log(error.message);
            return res.status(500).json({
                success: false,
                message: 'An error occurred while removing the coupon'
            });
        }
    },

    placeOrder: async (req, res) => {
        try {
            const userId = req.session.user.userId;
            const { paymentMethod, addressId } = req.body;

            const cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: { path: "categoryId", model: "Category" },
            });

            const address = await userAddress.findOne({ _id: addressId, userId });

            if (!cart || !address) {
                return res.status(400).json({
                    success: false,
                    message: "Cart or address not found",
                });
            }

            let subtotal = 0;
            let discountedSubtotal = 0;
            let totalOfferDiscount = 0;

            // First pass: Calculate basic totals and prepare item data
            const itemsData = cart.items.map((item) => {
                const product = item.productId;
                const variant = product.variants.find((v) => v.volume === item.volume);

                if (variant) {
                    const regularPrice = variant.regularPrice;
                    const productOffer = product.offer || 0;
                    const categoryOffer = product.categoryId?.offer || 0;

                    const maxOffer = Math.max(productOffer, categoryOffer);
                    const discountAmount = maxOffer > 0 ? (regularPrice * maxOffer) / 100 : 0;
                    const discountedPrice = regularPrice - discountAmount;

                    const itemSubtotal = regularPrice * item.quantity;
                    const itemDiscountedSubtotal = discountedPrice * item.quantity;
                    const itemOfferDiscount = (regularPrice - discountedPrice) * item.quantity;

                    subtotal += itemSubtotal;
                    discountedSubtotal += itemDiscountedSubtotal;
                    totalOfferDiscount += itemOfferDiscount;

                    return {
                        productId: product._id,
                        volume: item.volume,
                        quantity: item.quantity,
                        regularPrice: regularPrice,
                        itemDiscountedSubtotal: itemDiscountedSubtotal,
                        itemOfferDiscount: itemOfferDiscount
                    };
                }
            }).filter(Boolean);

            subtotal = Math.round(subtotal);
            discountedSubtotal = Math.round(discountedSubtotal);
            totalOfferDiscount = Math.round(totalOfferDiscount);

            let shipping = discountedSubtotal < 1000 ? 40 : 0;
            let couponDiscount = 0;
            let couponCode = null;

            if (req.session.appliedCoupon) {
                couponDiscount = req.session.appliedCoupon.discount || 0;
                couponCode = req.session.appliedCoupon.code;

                const coupon = await Coupon.findOne({
                    code: couponCode,
                    isActive: true,
                    startDate: { $lte: new Date() },
                    endDate: { $gte: new Date() },
                });

                if (!coupon) {
                    req.session.appliedCoupon = null;
                    couponDiscount = 0;
                    couponCode = null;
                } else {
                    const hasUsedCoupon = await Order.findOne({ userId, couponUsed: couponCode });
                    if (hasUsedCoupon) {
                        return res.status(400).json({
                            success: false,
                            message: 'You have already used this coupon',
                        });
                    }
                    await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
                }
            }

            const finalTotal = Math.max(0, discountedSubtotal + shipping - couponDiscount);

            // COD restriction: Orders above Rs 1000 cannot use COD
            if (paymentMethod === 'cod' && finalTotal > 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Cash on Delivery is not available for orders above ₹1000. Please choose online payment.',
                });
            }

            // Calculate total additional discounts to distribute
            const totalAdditionalDiscounts = couponDiscount;
            const totalOrderedItems = itemsData.reduce((sum, item) => sum + item.quantity, 0);

            // Second pass: Calculate itemSalePrice with distributed discounts
            const items = itemsData.map((item) => {
                let itemSalePrice = item.regularPrice;

                // Apply offer discount first (this is already item-specific)
                const offerDiscountPerUnit = item.itemOfferDiscount / item.quantity;
                itemSalePrice -= offerDiscountPerUnit;

                // Distribute additional discounts (coupon) proportionally
                if (totalAdditionalDiscounts > 0 && totalOrderedItems > 0) {
                    const itemWeight = item.itemDiscountedSubtotal / discountedSubtotal;
                    const itemShareOfAdditionalDiscounts = totalAdditionalDiscounts * itemWeight;
                    const additionalDiscountPerUnit = itemShareOfAdditionalDiscounts / item.quantity;
                    
                    itemSalePrice -= additionalDiscountPerUnit;
                }

                // Ensure itemSalePrice doesn't go below 0
                itemSalePrice = Math.max(0, Math.round(itemSalePrice * 100) / 100);

                return {
                    productId: item.productId,
                    volume: item.volume,
                    quantity: item.quantity,
                    itemSalePrice: itemSalePrice,
                    itemStatus: 'pending',
                };
            });

            const transactionId = 'TXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

            // Handle wallet payment
            if (paymentMethod === 'wallet') {
                // Get the latest wallet transaction to check balance
                const latestTransaction = await WalletTransaction.findOne({ userId }).sort({ createdAt: -1 });
                const walletBalance = latestTransaction ? latestTransaction.wallet.balance : 0;

                if (walletBalance < finalTotal) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient wallet balance. Available: ₹${walletBalance}, Required: ₹${finalTotal}`,
                    });
                }

                // Create order
                const newOrder = new Order({
                    orderId: 'ESP' + Date.now().toString().slice(-8),
                    userId,
                    paymentMethod,
                    orderDate: new Date().toDateString(),
                    paymentStatus: 'completed',
                    address: address._id,
                    items,
                    subtotal,
                    total: finalTotal,
                    amountPaid: finalTotal,
                    offerDiscount: totalOfferDiscount,
                    couponDiscount,
                    shipping,
                    status: 'pending',
                    transactionId,
                    couponUsed: couponCode,
                });

                await newOrder.save();

                // Update wallet balance in User model
                const user = await User.findById(userId);
                user.wallet.balance = walletBalance - finalTotal;
                user.wallet.lastUpdated = new Date();
                await user.save();

                // Update wallet balance and create transaction
                const newWalletTransaction = new WalletTransaction({
                    userId,
                    transactionId: 'WTXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
                    productId: items.map(item => item.productId).join(','), // Store comma-separated product IDs
                    amount: finalTotal,
                    type: 'payment',
                    status: 'success',
                    reference: newOrder.orderId,
                    description: `Payment for order ${newOrder.orderId}`,
                    wallet: {
                        balance: walletBalance - finalTotal,
                        lastUpdated: new Date(),
                    },
                });

                await newWalletTransaction.save();

                // Update inventory
                for (const item of cart.items) {
                    const product = await Product.findById(item.productId._id);
                    if (product) {
                        const variantIndex = product.variants.findIndex((v) => v.volume === item.volume);
                        if (variantIndex !== -1) {
                            product.variants[variantIndex].quantity -= item.quantity;
                            if (product.variants[variantIndex].quantity < 0) {
                                product.variants[variantIndex].quantity = 0;
                            }
                            await product.save();
                        }
                    }
                }

                // Clear cart
                await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

                // Set order details in session
                req.session.orderDetails = {
                    address,
                    cart,
                    subtotal,
                    discountedSubtotal,
                    totalOfferDiscount,
                    shipping,
                    couponDiscount,
                    couponCode,
                    total: finalTotal,
                    orderNumber: newOrder.orderId,
                    orderDate: new Date().toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                    }),
                    paymentMethod: 'Wallet',
                    transactionId,
                };

                req.session.appliedCoupon = null;

                return res.json({
                    success: true,
                    redirectUrl: "/user/orderSuccessful",
                });
            }

            // Handle Razorpay payment
            if (paymentMethod === 'razorpay') {
                const razorpayOrder = await razorpay.orders.create({
                    amount: Math.round(finalTotal * 100),
                    currency: 'INR',
                    receipt: `receipt_${transactionId}`,
                    payment_capture: 1,
                });

                return res.status(200).json({
                    success: true,
                    razorpayOrderId: razorpayOrder.id,
                    amount: finalTotal * 100,
                    currency: 'INR',
                    key_id: process.env.RAZORPAY_KEY_ID,
                    transactionId: transactionId,
                    orderDetails: {
                        addressId: address._id,
                        items,
                        subtotal,
                        total: finalTotal,
                        amountPaid: finalTotal,
                        offerDiscount: totalOfferDiscount,
                        couponDiscount,
                        shipping,
                        couponCode,
                    },
                });
            }

            // Handle COD payment
            const newOrder = new Order({
                orderId: 'ESP' + Date.now().toString().slice(-8),
                userId,
                paymentMethod,
                orderDate: new Date().toDateString(),
                paymentStatus: 'pending',
                address: address._id,
                items,
                subtotal,
                total: finalTotal,
                amountPaid: finalTotal,
                offerDiscount: totalOfferDiscount,
                couponDiscount,
                shipping,
                status: 'pending',
                transactionId,
                couponUsed: couponCode,
            });

            await newOrder.save();

            req.session.orderDetails = {
                address,
                cart,
                subtotal,
                discountedSubtotal,
                totalOfferDiscount,
                shipping,
                couponDiscount,
                couponCode,
                total: finalTotal,
                orderNumber: newOrder.orderId,
                orderDate: new Date().toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                }),
                paymentMethod: paymentMethod || 'Cash on Delivery',
                transactionId,
            };

            req.session.appliedCoupon = null;

            for (const item of cart.items) {
                const product = await Product.findById(item.productId._id);
                if (product) {
                    const variantIndex = product.variants.findIndex((v) => v.volume === item.volume);
                    if (variantIndex !== -1) {
                        product.variants[variantIndex].quantity -= item.quantity;
                        if (product.variants[variantIndex].quantity < 0) {
                            product.variants[variantIndex].quantity = 0;
                        }
                        await product.save();
                    }
                }
            }

            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

            return res.json({
                success: true,
                redirectUrl: "/user/orderSuccessful",
            });
        } catch (error) {
            console.log(error.message);
            return res.status(500).json({
                success: false,
                message: "An error occurred while placing the order",
            });
        }
    },

    orderSuccessful: async (req, res) => {
        try {
            const orderDetails = req.session.orderDetails;
            
            if (!orderDetails) {
                return res.redirect('/user/checkout');
            }
            
            const email = req.session.user.email;
            const user = await User.findOne({ email: email });
            
            res.render("user/orderSuccessful", {
                orderNumber: orderDetails.orderNumber,
                orderDate: orderDetails.orderDate,
                paymentMethod: orderDetails.paymentMethod,
                customerName: orderDetails.address.name,
                address: orderDetails.address.address,
                phone: orderDetails.address.phoneNumber,
                cart: orderDetails.cart,
                subtotal: orderDetails.subtotal,
                discountedSubtotal: orderDetails.discountedSubtotal,
                totalOfferDiscount: orderDetails.totalOfferDiscount,
                shipping: orderDetails.shipping,
                couponDiscount: orderDetails.couponDiscount,
                couponCode: orderDetails.couponCode,
                total: orderDetails.total,
                totalSavings: (orderDetails.totalOfferDiscount || 0) + 
                            (orderDetails.couponDiscount || 0),
                user: user
            });
        } catch (error) {
            console.log(error.message);
            res.redirect('/user/checkout');
        }
    },

    orderDetails: async (req, res) => {
        try {
            const orderDetails = req.session.orderDetails;

            if (!orderDetails) {
                return res.redirect('/user/checkout');
            }
            
            const email = req.session.user.email;
            const user = await User.findOne({ email: email });

            res.render("user/orderDetails", {
                orderNumber: orderDetails.orderNumber,
                orderDate: orderDetails.orderDate,
                paymentMethod: orderDetails.paymentMethod,
                customerName: orderDetails.address.name,
                address: orderDetails.address.address,
                phone: orderDetails.address.phoneNumber,
                cart: orderDetails.cart,
                subtotal: orderDetails.subtotal,
                shipping: orderDetails.shipping,
                couponDiscount: orderDetails.couponDiscount,
                total: orderDetails.total,
                user: user
            });
        } catch (error) {
            console.log(error.message);
        }
    },

    createRazorpayOrder: async (req, res) => {
        try {
            const userId = req.session.user.userId;
            const { addressId, paymentMethod, total, orderId } = req.body;

            // Handle retry payment for existing order
            if (orderId) {
                const order = await Order.findById(orderId).populate('address');
                
                if (!order) {
                    return res.status(404).json({ 
                        success: false, 
                        message: "Order not found" 
                    });
                }

                // Check if order belongs to current user
                if (order.userId.toString() !== userId) {
                    return res.status(403).json({ 
                        success: false, 
                        message: "Unauthorized access" 
                    });
                }

                // Check if order is eligible for retry (failed payment)
                if (order.paymentStatus !== 'failed') {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Order payment status doesn't allow retry" 
                    });
                }

                // Create new Razorpay order for retry
                const razorpayOrder = await razorpay.orders.create({
                    amount: Math.round(order.total * 100),
                    currency: 'INR',
                    receipt: `retry_${Date.now()}`,
                    payment_capture: 1
                });

                // Update order with new Razorpay order ID
                order.razorpayOrderId = razorpayOrder.id;
                order.paymentStatus = 'pending';
                order.status = 'pending';
                
                order.items.forEach(item => {
                    if (item.itemStatus === 'payment failed') {
                        item.itemStatus = 'pending';
                    }
                });
                
                await order.save();

                // Get user details for prefill
                const user = await User.findById(userId);

                return res.json({
                    success: true,
                    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                    order: {
                        id: razorpayOrder.id,
                        amount: razorpayOrder.amount,
                        currency: razorpayOrder.currency
                    },
                    orderId: order._id,
                    customerName: order.address.name,
                    email: user.email,
                    phone: order.address.phoneNumber
                });
            }

            // Handle new order creation
            const cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: { path: "categoryId", model: "Category" }
            });

            const address = await userAddress.findOne({ _id: addressId, userId });

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: 'Address not found'
                });
            }

            let subtotal = 0;
            let discountedSubtotal = 0;
            let totalOfferDiscount = 0;

            // First pass: Calculate subtotals and offer discounts
            const itemsWithCalculations = cart.items.map((item) => {
                const product = item.productId;
                const variant = product.variants.find(v => v.volume === item.volume);

                if (variant) {
                    const regularPrice = variant.regularPrice;
                    const productOffer = product.offer || 0;
                    const categoryOffer = product.categoryId?.offer || 0;

                    const maxOffer = Math.max(productOffer, categoryOffer);
                    const discountAmount = maxOffer > 0 ? (regularPrice * maxOffer) / 100 : 0;
                    const discountedPrice = regularPrice - discountAmount;

                    const itemSubtotal = regularPrice * item.quantity;
                    const itemDiscountedSubtotal = discountedPrice * item.quantity;
                    const itemOfferDiscount = (regularPrice - discountedPrice) * item.quantity;

                    subtotal += itemSubtotal;
                    discountedSubtotal += itemDiscountedSubtotal;
                    totalOfferDiscount += itemOfferDiscount;

                    return {
                        productId: product._id,
                        volume: item.volume,
                        quantity: item.quantity,
                        regularPrice: regularPrice,
                        itemOfferDiscount: itemOfferDiscount,
                        itemStatus: 'pending'
                    };
                }
            }).filter(Boolean);

            subtotal = Math.round(subtotal);
            discountedSubtotal = Math.round(discountedSubtotal);
            totalOfferDiscount = Math.round(totalOfferDiscount);

            let shipping = discountedSubtotal < 1000 ? 40 : 0;
            let couponDiscount = 0;
            let couponCode = null;

            if (req.session.appliedCoupon) {
                couponDiscount = req.session.appliedCoupon.discount || 0;
                couponCode = req.session.appliedCoupon.code;
            }

            const finalTotal = Math.max(0, discountedSubtotal + shipping - couponDiscount);
            const transactionId = 'TXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

            // Calculate total number of items (considering quantities)
            const totalItemsCount = itemsWithCalculations.reduce((sum, item) => sum + item.quantity, 0);
            
            // Calculate per-item discount distribution
            const totalAdditionalDiscounts = couponDiscount;
            const discountPerItem = totalAdditionalDiscounts / totalItemsCount;

            // Second pass: Calculate final itemSalePrice with distributed discounts
            const items = itemsWithCalculations.map((item) => {
                const perUnitOfferDiscount = item.itemOfferDiscount / item.quantity;
                const perUnitAdditionalDiscount = discountPerItem;
                
                const itemSalePrice = Math.max(0, item.regularPrice - perUnitOfferDiscount - perUnitAdditionalDiscount);

                return {
                    productId: item.productId,
                    volume: item.volume,
                    quantity: item.quantity,
                    itemSalePrice: Math.round(itemSalePrice * 100) / 100,
                    itemStatus: item.itemStatus
                };
            });

            const options = {
                amount: Math.round(finalTotal * 100),
                currency: 'INR',
                receipt: `receipt_${transactionId}`,
                payment_capture: 1
            };

            const razorpayOrder = await razorpay.orders.create(options);

            const newOrder = new Order({
                orderId: 'ESP' + Date.now().toString().slice(-8),
                userId,
                paymentMethod: 'razorpay',
                orderDate: new Date().toDateString(),
                paymentStatus: 'pending',
                address: address._id,
                items,
                subtotal,
                total: finalTotal,
                amountPaid: 0,
                offerDiscount: totalOfferDiscount,
                couponDiscount,
                shipping,
                status: 'pending',
                transactionId,
                couponUsed: couponCode,
                razorpayOrderId: razorpayOrder.id
            });

            await newOrder.save();

            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

            const user = await User.findById(userId);

            return res.status(200).json({
                success: true,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                order: {
                    id: razorpayOrder.id,
                    amount: options.amount,
                    currency: options.currency
                },
                orderId: newOrder._id,
                customerName: address.name,
                email: user.email,
                phone: address.phoneNumber
            });
        } catch (error) {
            console.log('Error in createRazorpayOrder:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Error creating Razorpay order'
            });
        }
    },

    verifyRazorpayPayment: async (req, res) => {
        try {
            const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
            const userId = req.session.user.userId;

            const crypto = require('crypto');
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                await Order.findByIdAndUpdate(orderId, {
                    paymentStatus: 'failed',
                    status: 'failed',
                    $set: { 'items.$[].itemStatus': 'payment failed' }
                });

                return res.status(400).json({
                    success: false,
                    message: 'Payment verification failed',
                    redirectUrl: `/user/paymentFailed?orderId=${orderId}`
                });
            }

            const order = await Order.findById(orderId).populate('address');
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found',
                    redirectUrl: '/user/checkout'
                });
            }

            if (order.userId.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access',
                    redirectUrl: '/user/checkout'
                });
            }

            order.paymentStatus = 'completed';
            order.status = 'pending';
            order.amountPaid = order.total;
            order.razorpayPaymentId = razorpay_payment_id;
            
            order.items.forEach(item => {
                item.itemStatus = 'pending';
            });
            
            await order.save();

            const isRetryPayment = order.amountPaid > 0;
            
            if (!isRetryPayment) {
                for (const item of order.items) {
                    const product = await Product.findById(item.productId);
                    if (product) {
                        const variantIndex = product.variants.findIndex(v => v.volume === item.volume);
                        if (variantIndex !== -1) {
                            product.variants[variantIndex].quantity -= item.quantity;
                            if (product.variants[variantIndex].quantity < 0) {
                                product.variants[variantIndex].quantity = 0;
                            }
                            await product.save();
                        }
                    }
                }

                await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
            }

            if (order.couponUsed && !isRetryPayment) {
                await Coupon.findOneAndUpdate(
                    { code: order.couponUsed },
                    { $inc: { usedCount: 1 } }
                );
            }

            req.session.orderDetails = {
                address: order.address,
                cart: { items: [] },
                subtotal: order.subtotal,
                discountedSubtotal: order.subtotal - order.offerDiscount,
                totalOfferDiscount: order.offerDiscount,
                shipping: order.shipping,
                couponDiscount: order.couponDiscount,
                couponCode: order.couponUsed,
                total: order.total,
                orderNumber: order.orderId,
                orderDate: new Date(order.orderDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                paymentMethod: 'Razorpay',
                transactionId: order.transactionId
            };

            if (!isRetryPayment) {
                req.session.appliedCoupon = null;
            }

            return res.status(200).json({
                success: true,
                message: 'Payment verified successfully',
                redirectUrl: '/user/orderSuccessful'
            });
        } catch (error) {
            console.log('Error in verifyRazorpayPayment:', error.message);
            
            if (req.body.orderId) {
                await Order.findByIdAndUpdate(req.body.orderId, {
                    paymentStatus: 'failed',
                    status: 'failed',
                    $set: { 'items.$[].itemStatus': 'payment failed' }
                });
            }
            
            return res.status(500).json({
                success: false,
                message: 'Error verifying payment',
                redirectUrl: `/user/paymentFailed?orderId=${req.body.orderId}`
            });
        }
    },

    paymentFailed: async (req, res) => {
        try {
            const { orderId } = req.query;
            const email = req.session.user.email;
            const userId = req.session.user.userId;
            const user = await User.findOne({ email });
            const cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: {
                    path: "categoryId",
                    select: "name offer status"
                }
            });

            if (orderId) {
                await Order.findByIdAndUpdate(orderId, {
                    paymentStatus: 'failed',
                    status: 'failed',
                    $set: { 'items.$[].itemStatus': 'payment failed' }
                });
            }

            res.render('user/paymentFailed', {
                message: 'Payment was unsuccessful. Please try again.',
                orderId: orderId,
                cart,
                user
            });
        } catch (error) {
            console.log(error.message);
            res.redirect('/user/checkout');
        }
    }
}

module.exports = checkoutController