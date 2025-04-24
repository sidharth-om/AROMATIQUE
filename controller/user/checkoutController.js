const Cart=require("../../models/cartModel")
const User=require("../../models/userModel")
const userAddress=require("../../models/userAdressModel")
const Order=require("../../models/orderModel")
const Product=require("../../models/productModel")

const checkoutController={
    loadCheckout: async (req, res) => {
        try {
            const email = req.session.user.email;
            const userId = req.session.user.userId;
            
           
            const cart = await Cart.findOne({ userId }).populate("items.productId");
            
          
            if (!cart || !cart.items || cart.items.length <= 0) {
                // Redirect to cart page with a message
                return res.redirect('/user/cart?message=Your cart is empty. Please add items before checkout.');
            }
            
           
            const user = await User.findOne({ email: email });
            const address = await userAddress.find({ userId: userId, status: "active" });
            
            let subtotal = 0;
            cart.items.forEach((item) => {
                const product = item.productId;
                const variant = product.variants.find(v => v.volume === item.volume);

                if (variant) {
                    subtotal += variant.regularPrice * item.quantity;
                }
            });

            let discount = 0;
            if (subtotal > 2000) {
                discount = Math.floor(subtotal * 0.10);
            }

            let shipping = 0;
            if (subtotal < 1000) {
                shipping = 40;
            }

            const total = subtotal + shipping - discount;

            res.render("user/checkout", { cart, address, subtotal, discount, total, shipping, user });
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
        // const {addressId}=req.body
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
        placeOrder: async (req, res) => {
            try {
                const userId = req.session.user.userId;
                
                // Get cart items and selected address
                const cart = await Cart.findOne({userId}).populate("items.productId");
                const addressId = req.query.addressId || req.body.addressId;
                const address = await userAddress.findOne({_id: addressId, userId: userId});

                console.log("cart::",cart,"addressId::",addressId,"address::",address)
                
                if (!cart || !address) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Cart or address not found" 
                    });
                }

               
                
                // Calculate order totals (same logic as in loadCheckout)
                let subtotal = 0;
                // cart.items.forEach((item) => {
                //     const product = item.productId;
                //     const variant = product.variants.find(v => v.volume === item.volume);
                const items = cart.items.map((item) => {
                    const product = item.productId;
                    const variant = product.variants.find(v => v.volume === item.volume);
                    
                    if(variant) {
                        subtotal += variant.regularPrice * item.quantity;
                    }

                    return {
                        productId: product._id,
                        volume: item.volume, // using `volume` as size
                        quantity: item.quantity,
                        itemSalePrice: variant ? variant.regularPrice : 0,
                        itemStatus: 'pending'
                    };
                });
                
                let discount = 0;
                if(subtotal > 2000) {
                    discount = Math.floor(subtotal * 0.10);
                }
                
                let shipping = 0;
                if(subtotal < 1000) {
                    shipping = 40;
                }
                
                const total = subtotal + shipping - discount;

                const transactionId = 'TXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

                console.log("trdid",transactionId)
                
                // Store order details in session for the success page
                req.session.orderDetails = {
                    address: address,
                    cart: cart,
                    subtotal: subtotal,
                    shipping: shipping,
                    discount: discount,
                    total: total,
                    orderNumber: 'ESP' + Date.now().toString().slice(-8),
                    orderDate: new Date().toLocaleDateString('en-US', { 
                        weekday: 'short', // 'Fri'
                        year: 'numeric',  // '2025'
                        month: 'short',   // 'Apr' 
                        day: 'numeric'    // '11'
                    }),
                    paymentMethod: req.body.paymentMethod || 'Cash on Delivery',
                    transactionId: transactionId 
                };
                
                const newOrder = new Order({
                    orderId: req.session.orderDetails.orderNumber,
                    userId: userId,
                    paymentMethod: req.session.orderDetails.paymentMethod,
                    orderDate:new Date().toDateString(),
                    paymentStatus: 'pending',
                    address: address._id, // storing reference to Address
                    items: items,
                    amountPaid: req.session.orderDetails.total,
                    total: req.session.orderDetails.total,
                    status: 'pending',
                    transactionId: transactionId 
                });
                
                await newOrder.save();


                for(const item of cart.items){
                    const product=await Product.findById((item.productId._id))

                    if(product){
                        const variantIndex=product.variants.findIndex(v=>v.volume===item.volume)

                        if(variantIndex!==-1){
                            product.variants[variantIndex].quantity-=item.quantity
                        
                        if (product.variants[variantIndex].quantity < 0) {
                            product.variants[variantIndex].quantity = 0;
                        }

                        await product.save()

                    }
                }
                }

                await Cart.findOneAndUpdate(
                    { userId: userId },
                    { $set: { items: [] } }
                );

                
                return res.json({ 
                    success: true, 
                    redirectUrl: "/user/orderSuccessful" 
                });
                
            } catch (error) {
                console.log(error.message);
                return res.status(500).json({ 
                    success: false, 
                    message: "An error occurred while placing the order" 
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
                
                 const email=req.session.user.email
                 const userId=req.session.user.userId
                 const user=await User.findOne({email:email})
                // Render order success page with the details
                res.render("user/orderSuccessful", {
                    orderNumber: orderDetails.orderNumber,
                    orderDate: orderDetails.orderDate,
                    paymentMethod: orderDetails.paymentMethod,
                    customerName: orderDetails.address.name,
                    address: orderDetails.address.address,
                    phone: orderDetails.address.phoneNumber,
                    cart: orderDetails.cart,
                    subtotal: orderDetails.subtotal,
                    shipping: orderDetails.shipping,
                    discount: orderDetails.discount,
                    total: orderDetails.total,
                    user:user
                });
                
                // Clear the order details from session after displaying
                // req.session.orderDetails = null;
                
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
                    discount: orderDetails.discount,
                    total: orderDetails.total,
                    user:user
                })
            } catch (error) {
                console.log(error.message)
            }
        }

}

module.exports=checkoutController