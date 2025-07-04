const Cart=require("../../models/cartModel")
const User=require("../../models/userModel")
const userAddress=require("../../models/userAdressModel")
const Order=require("../../models/orderModel")
const Product=require("../../models/productModel")
const Coupon = require("../../models/couponModel")
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const checkoutController={
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

             // ✅ Stock Validation
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
            
            // Get available coupons
            const availableCoupons = await Coupon.find({
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            });
            
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
            
            // Calculate fixed discount for orders above 2000
            let discount = 0;
            if (discountedSubtotal > 2000) {
                discount = Math.floor(discountedSubtotal * 0.10);
            }

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
            const total = discountedSubtotal + shipping - discount - appliedCouponDiscount;

            res.render("user/checkout", { 
                cart, 
                address, 
                subtotal, 
                discountedSubtotal,
                discount, 
                total, 
                shipping, 
                user,
                availableCoupons,
                appliedCoupon: req.session.appliedCoupon || null
            });
        } catch (error) {
            console.log(error.message);
            res.redirect('/user/cart?message=An error occurred. Please try again.');
        }
    },
    
    checkoutEditAddress:async (req,res) => {
        try {
            const userId = req.session.user?.userId;
            const addressId=req.params.id
             const address=await userAddress.find({userId:userId,_id:addressId})
             console.log("addr::",address)
            res.render("user/editAddress",{address})
        } catch (error) {
            console.log(error.message)
        }
    },
    
    checkoutDeleteAddress:async (req,res) => {
        try {
            console.log("Toggle address status request received");
            console.log("Request body:", req.body);
            console.log("Address ID from request:", req.body.addressId);
    
            const  userId = req.session.user?.userId;
            const addressId =  req.body.addressId;
    
            const address=await userAddress.findOne({_id:addressId,userId:userId})
    
            if (!address) {
                return res.status(404).json({ success: false, message: 'Address not found or does not belong to you' });
            }

            address.status = address.status === 'active' ? 'blocked' : 'active';
            await address.save();

            console.log("urr:",address.status)
            return res.status(200).json({ 
                success: true, 
                message: `Address ${address.status === 'active' ? 'unblocked' : 'blocked'} successfully`, 
                status: address.status 
            });
        } catch (error) {
            console.log(error.message)
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
            
            // Calculate cart subtotal with existing discounts (same as in loadCheckout)
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
            
            // Round the discount
            couponDiscount = Math.round(couponDiscount);
            
            // Store coupon info in session for order processing
            req.session.appliedCoupon = {
                code: coupon.code,
                discount: couponDiscount,
                type: coupon.type,
                description: coupon.description
            };
            
            // Calculate new totals
            let systemDiscount = 0;
            if (discountedSubtotal > 2000) {
                systemDiscount = Math.floor(discountedSubtotal * 0.10);
            }
            
            const newTotal = discountedSubtotal + shipping - systemDiscount - couponDiscount;
            
            // Return successful result with discount info and updated totals
            return res.status(200).json({
                success: true,
                message: 'Coupon applied successfully',
                couponDiscount: couponDiscount,
                couponType: coupon.type,
                couponDescription: coupon.description,
                newTotal: newTotal,
                systemDiscount: systemDiscount,
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

    // Remove applied coupon
    removeCoupon: async (req, res) => {
        try {
            const userId = req.session.user.userId;
            
            // Get cart to recalculate totals
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
            
            // Calculate discounted subtotal
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
            
            // Calculate other values
            let systemDiscount = 0;
            if (discountedSubtotal > 2000) {
                systemDiscount = Math.floor(discountedSubtotal * 0.10);
            }
            
            let shipping = discountedSubtotal < 1000 ? 40 : 0;
            const newTotal = discountedSubtotal + shipping - systemDiscount;
            
            // Remove coupon from session
            req.session.appliedCoupon = null;
            
            return res.status(200).json({
                success: true,
                message: 'Coupon removed successfully',
                newTotal: newTotal,
                systemDiscount: systemDiscount,
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

    const items = cart.items.map((item) => {
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
          itemSalePrice: regularPrice,
          itemStatus: 'pending',
        };
      }
    });

    subtotal = Math.round(subtotal);
    discountedSubtotal = Math.round(discountedSubtotal);
    totalOfferDiscount = Math.round(totalOfferDiscount);

    let systemDiscount = discountedSubtotal > 2000 ? Math.floor(discountedSubtotal * 0.10) : 0;
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

    const finalTotal = Math.max(0, discountedSubtotal + shipping - systemDiscount - couponDiscount);
    const transactionId = 'TXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    if (paymentMethod === 'razorpay') {
      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalTotal * 100), // Convert to paise
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
          systemDiscount,
          couponDiscount,
          shipping,
          couponCode,
        },
      });
    }

    // For COD or wallet payments
    const newOrder = new Order({
      orderId: 'ESP' + Date.now().toString().slice(-8),
      userId,
      paymentMethod,
      orderDate: new Date().toDateString(),
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'completed',
      address: address._id,
      items,
      subtotal,
      total: finalTotal,
      amountPaid: finalTotal,
      offerDiscount: totalOfferDiscount,
      systemDiscount,
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
      systemDiscount,
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
            // Get order details from session
            const orderDetails = req.session.orderDetails;
            
            if (!orderDetails) {
                return res.redirect('/user/checkout');
            }
            
            const email = req.session.user.email;
            const userId = req.session.user.userId;
            const user = await User.findOne({email: email});
            
            // Render order success page with the complete details
            res.render("user/orderSuccessful", {
                orderNumber: orderDetails.orderNumber,
                orderDate: orderDetails.orderDate,
                paymentMethod: orderDetails.paymentMethod,
                customerName: orderDetails.address.name,
                address: orderDetails.address.address,
                phone: orderDetails.address.phoneNumber,
                cart: orderDetails.cart,
                
                // Price breakdown
                subtotal: orderDetails.subtotal, // Original price
                discountedSubtotal: orderDetails.discountedSubtotal, // After product/category offers
                totalOfferDiscount: orderDetails.totalOfferDiscount, // Product/category discount
                systemDiscount: orderDetails.systemDiscount, // 10% system discount
                shipping: orderDetails.shipping,
                couponDiscount: orderDetails.couponDiscount, // Coupon discount
                couponCode: orderDetails.couponCode,
                total: orderDetails.total, // Final amount paid
                
                // Calculate total savings
                totalSavings: (orderDetails.totalOfferDiscount || 0) + 
                             (orderDetails.systemDiscount || 0) + 
                             (orderDetails.couponDiscount || 0),
                
                user: user
            });
            
        } catch (error) {
            console.log(error.message);
            res.redirect('/user/checkout');
        }
    },
    
    orderDetails:async (req,res) => {
        try {
            const orderDetails=req.session.orderDetails

            if (!orderDetails) {
                return res.redirect('/user/checkout');
            }
            
            const email=req.session.user.email
            const user=await User.findOne({email:email})

            res.render("user/orderDetails",{
                orderNumber: orderDetails.orderNumber,
                orderDate: orderDetails.orderDate,
                paymentMethod: orderDetails.paymentMethod,
                customerName: orderDetails.address.name,
                address: orderDetails.address.address,
                phone: orderDetails.address.phoneNumber,
                cart: orderDetails.cart,
                subtotal: orderDetails.subtotal,
                shipping: orderDetails.shipping,
                discount: orderDetails.systemDiscount,
                couponDiscount: orderDetails.couponDiscount,
                total: orderDetails.total,
                user:user
            })
        } catch (error) {
            console.log(error.message)
        }
    },

createRazorpayOrder: async (req, res) => {
    try {
        const userId = req.session.user.userId;
        const { addressId, paymentMethod, total } = req.body;

        // Get cart and address
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

        // Calculate totals (same logic as in placeOrder)
        let subtotal = 0;
        let discountedSubtotal = 0;
        let totalOfferDiscount = 0;

        const items = cart.items.map((item) => {
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
                    itemSalePrice: regularPrice,
                    itemStatus: 'pending'
                };
            }
        }).filter(Boolean);

        subtotal = Math.round(subtotal);
        discountedSubtotal = Math.round(discountedSubtotal);
        totalOfferDiscount = Math.round(totalOfferDiscount);

        let systemDiscount = discountedSubtotal > 2000 ? Math.floor(discountedSubtotal * 0.10) : 0;
        let shipping = discountedSubtotal < 1000 ? 40 : 0;
        let couponDiscount = 0;
        let couponCode = null;

        if (req.session.appliedCoupon) {
            couponDiscount = req.session.appliedCoupon.discount || 0;
            couponCode = req.session.appliedCoupon.code;
        }

        const finalTotal = Math.max(0, discountedSubtotal + shipping - systemDiscount - couponDiscount);
        const transactionId = 'TXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

        // Create Razorpay order
        const options = {
            amount: Math.round(finalTotal * 100), // Convert to paise
            currency: 'INR',
            receipt: `receipt_${transactionId}`,
            payment_capture: 1
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Create pending order in database
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
            amountPaid: 0, // Will be updated after payment verification
            offerDiscount: totalOfferDiscount,
            systemDiscount,
            couponDiscount,
            shipping,
            status: 'pending',
            transactionId,
            couponUsed: couponCode,
            razorpayOrderId: razorpayOrder.id
        });

        await newOrder.save();

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
            email: req.session.user.email,
            phone: address.phoneNumber
        });

    } catch (error) {
        console.log(error.message);
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

        // Verify payment signature
        const crypto = require('crypto');
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            // Payment verification failed - update order status
            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: 'failed',
                status: 'cancelled'
            });

            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Payment verified successfully
        const order = await Order.findById(orderId).populate('address');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Update order with payment details
        order.paymentStatus = 'completed';
        order.amountPaid = order.total;
        order.razorpayPaymentId = razorpay_payment_id;
        await order.save();

        // Update product quantities
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

        // Update coupon usage
        if (order.couponUsed) {
            await Coupon.findOneAndUpdate(
                { code: order.couponUsed },
                { $inc: { usedCount: 1 } }
            );
        }

        // Clear cart
        await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

        // Set session data for success page
        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            populate: { path: "categoryId", model: "Category" }
        });

        req.session.orderDetails = {
            address: order.address,
            cart: { items: [] }, // Cart is now empty
            subtotal: order.subtotal,
            discountedSubtotal: order.subtotal - order.offerDiscount,
            totalOfferDiscount: order.offerDiscount,
            systemDiscount: order.systemDiscount,
            shipping: order.shipping,
            couponDiscount: order.couponDiscount,
            couponCode: order.couponUsed,
            total: order.total,
            orderNumber: order.orderId,
            orderDate: new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }),
            paymentMethod: 'Razorpay',
            transactionId: order.transactionId
        };

        // Clear coupon from session
        req.session.appliedCoupon = null;

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully'
        });

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            success: false,
            message: 'Error verifying payment'
        });
    }
},
paymentFailed: async (req, res) => {
    try {
        const { orderId } = req.query;
        
        if (orderId) {
            // Update order status to failed
            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: 'failed',
                status: 'cancelled'
            });
        }

        res.render('user/paymentFailed', {
            message: 'Payment was unsuccessful. Please try again.',
            orderId: orderId
        });
    } catch (error) {
        console.log(error.message);
        res.redirect('/user/checkout');
    }
}
}

module.exports=checkoutController