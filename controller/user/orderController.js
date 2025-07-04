const Order=require("../../models/orderModel")
const User=require("../../models/userModel")
const Cart=require("../../models/cartModel")
const Product=require("../../models/productModel")
const userAddress = require("../../models/userAdressModel");
const PDFDocument = require('pdfkit')

const orderController={
myOrders: async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const searchQuery = req.query.search ? req.query.search.trim() : "";

    // Log the search query for debugging
    console.log("Search Query:", searchQuery);

    // Base filter for logged-in user's orders
    const filter = { userId };

    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, "i");
      filter.$or = [
        { orderId: searchRegex },
        { status: searchRegex },
      ];
    }

    // Log the filter for debugging
    console.log("MongoDB Filter:", JSON.stringify(filter, null, 2));

    // Fetch orders with populated productId
    const orders = await Order.find(filter)
      .populate({
        path: "items.productId",
        match: searchQuery ? { name: { $regex: searchQuery, $options: "i" } } : null,
        select: "name images variants" // Include fields needed by the template
      })
      .sort({ createdAt: -1 }); // Changed to sort by createdAt to match frontend

    // Log raw orders for debugging
    console.log("Raw Orders:", JSON.stringify(orders, null, 2));

    // Filter orders to ensure at least one item has a valid productId
    const filteredOrders = orders.filter((order) =>
      order.items.some((item) => item.productId !== null)
    );

    // Log filtered orders for debugging
    console.log("Filtered Orders:", filteredOrders.length);

    const email = req.session.user.email;
    const user = await User.findOne({ email });
    const cart = await Cart.findOne({ userId });

    res.render("user/myOrders", { orders: filteredOrders, user, cart, searchQuery });
  } catch (error) {
    console.error("Error in myOrders:", error.message);
    res.status(500).render("error", {
      message: "Failed to load orders. Please try again later.",
    });
  }
},
    viewOrder: async (req, res) => {
        try {
            const { orderId, itemIndex } = req.params;
            const index = parseInt(itemIndex);
            const userId=req.session.user.userId
            
            // Find the order by its orderId field (not MongoDB _id)
           const order = await Order.findOne({ orderId: orderId })
    .populate({
        path: "items.productId",
        populate: {
            path: "categoryId",
            model: "Category"
        }
    })
    .populate("address");

                
            if (!order) {
                return res.status(404).render("error", { 
                    message: "Order not found" 
                });
            }
            
            // Get the specific item using the index
            const orderItem = order.items[index];
            
            if (!orderItem) {
                return res.status(404).render("error", { 
                    message: "Product not found in this order" 
                });
            }
            
            let subtotal=0
            const quantity=orderItem.quantity
            orderItem.productId.variants.forEach(item => {
                const price=item.regularPrice
                subtotal += price * quantity
            });
           
            let totalAmount=subtotal

            // console.log("sub::",subtotal)
            // console.log("orderItem::",orderItem)
            // Get other items in this order (excluding current item)
            const otherItems = order.items.filter((item, idx) => idx !== index);
            
            // Format current date for display
            const currentDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            });
            
            // Calculate pricing info
            const itemPrice = orderItem.itemSalePrice || 0;

console.log("ordd::",order)
            const viewData = {
                index:index,
                order: order,
                product: orderItem.productId,
                orderItem: orderItem,
                currentDate: currentDate,
                customer: {
                    name: req.session.user.name || "Customer",
                    address: order.address,
                    phone: order.address.mobile
                },
                pricing: {
                    // Calculate any pricing information needed by your view
                    totalAmount: order.total,
                     couponDiscount: order.couponDiscount || 0
                    // Other pricing details...
                }
            };
            
             const cart=await Cart.findOne({userId})

            const email=req.session.user.email
            const user=await User.findOne({email:email})
            res.render("user/viewOrder", {viewData,subtotal,totalAmount,user,cart});
        } catch (error) {
            console.log(error.message);
           
        }
    },
    cancelOrder: async (req, res) => {
        try {
            console.log("hey sid")
            const { orderId } = req.params;
            const { itemIndex } = req.body; // Get the item index from the request body
            console.log("ordiddd::", orderId);
            console.log("itemIndex::", itemIndex);
            
            // Find the order by its MongoDB _id
            const order = await Order.findById(orderId);
            
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
            
            // Check if the item index is valid
            if (itemIndex === undefined || !order.items[itemIndex]) {
                return res.status(404).json({ success: false, message: 'Order item not found' });
            }
            
            // Get the specific item
            const orderItem = order.items[itemIndex];
            
            // Check if the item status is cancellable
            // const cancellableItemStatuses = ['pending', 'processing'];
            const cancellableItemStatuses= ["pending", "processing", "shipped","delivered", "cancelled","return request","returned","failed"]
            if (!cancellableItemStatuses.includes(orderItem.itemStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'This item cannot be cancelled as it is already shipped or delivered'
                });
            }

             // ✅ Update product stock
        const product = await Product.findById(orderItem.productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found for stock update' });
        }

        const variant = product.variants.find(v => v.volume === orderItem.volume);
        if (!variant) {
            return res.status(404).json({ success: false, message: 'Product variant not found for stock update' });
        }

        variant.quantity += orderItem.quantity;
        await product.save();
        console.log(`Stock updated for ${product.name} (${variant.volume})`);
            
            // Update the item status to cancelled
            orderItem.itemStatus = 'cancelled';
            
            // If all items are cancelled, update the overall order status
            const allCancelled = order.items.every(item => item.itemStatus === 'cancelled');
            if (allCancelled) {
                order.status = 'cancelled';
            }
            
            // Save the updated order
            await order.save();
            
            return res.status(200).json({
                success: true,
                message: 'Item cancelled successfully',
                order
            });
        } catch (error) {
            console.log(error.message);
            return res.status(500).json({ success: false, message: 'Server error during item cancellation' });
        }
    },
    cancelEntireOrder: async (req, res) => {
        try {
            const { orderId } = req.params;
            console.log("ordIddd::", orderId);
            
            // Find the order by the orderId (not MongoDB _id)
            const order = await Order.findOne({ orderId });
            
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
            
            // Check if order is cancellable (not shipped or delivered)
            const cancellableOrderStatuses = ['pending', 'processing'];
            if (!cancellableOrderStatuses.includes(order.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'This order cannot be cancelled as it is already shipped or delivered'
                });
            }
            
            // Update the main order status to cancelled
            order.status = 'cancelled';
            
            // Update all item statuses to cancelled
            order.items.forEach(item => {
                item.itemStatus = 'cancelled';
            });
            
            // Save the updated order
            await order.save();
            
            return res.status(200).json({
                success: true,
                message: 'Order cancelled successfully',
                order
            });
        } catch (error) {
            console.log(error.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Server error during order cancellation' 
            });
        }
    },
    returnRequest:async (req,res) => {
        try {
            const { orderId, itemId, productId, quantity, reason } = req.body;
            const userId=req.session.user.userId

            const order=await Order.findOne({orderId:orderId,userId:userId})

            // console.log("orr:",order)

            if (!order) {
                return res.status(404).json({ 
                  success: false, 
                  message: 'Order not found or does not belong to this user' 
                });
              }

              const itemIndex = order.items.findIndex(item => 
                item._id.toString() === itemId
              );

              const orderItem = order.items[itemIndex];

              if (orderItem.itemStatus !== 'delivered') {
                return res.status(400).json({ 
                  success: false, 
                  message: 'Only delivered items can be returned' 
                });
              }

              orderItem.itemStatus = 'return request';
              orderItem.reason = reason;
              orderItem.requestQuantity = quantity;

             // Update the order's returnRequest field
                order.returnRequest = {
                    isRequested: true,
                    reason: reason,
                    requestedAt: new Date()
                };
            
                // Save the updated order
                await order.save();              

                return res.status(200).json({
                    success: true,
                    message: 'Return request submitted successfully',
                    data: {
                      orderId: order.orderId,
                      itemStatus: orderItem.itemStatus,
                      requestedAt: order.returnRequest.requestedAt
                    }
                  });

           
        } catch (error) {
            console.log(error.message)
        }
    },

   generateInvoice: async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.session.user.userId;
        
        // Find the order with populated product and category data
        const order = await Order.findOne({ orderId: orderId, userId: userId })
            .populate({
                path: "items.productId",
                populate: {
                    path: "categoryId",
                    model: "Category"
                }
            })
            .populate("address");
            
        if (!order) {
            return res.status(404).render("error", { 
                message: "Order not found" 
            });
        }
        
        // Find the specific item in the order
        const orderItem = itemId ? order.items.find(item => item._id.toString() === itemId) : null;
        
        // If itemId is provided but item not found
        if (itemId && !orderItem) {
            return res.status(404).render("error", { 
                message: "Item not found in this order" 
            });
        }
        
        // Helper function to calculate the best offer price
        const calculateOfferPrice = (product, volume, regularPrice) => {
            const productOffer = product.offer || 0;
            const categoryOffer = product.categoryId?.offer || 0;
            
            // Get the highest offer between product and category
            const bestOffer = Math.max(productOffer, categoryOffer);
            
            // Calculate the discounted price
            const discountAmount = (regularPrice * bestOffer) / 100;
            const offerPrice = regularPrice - discountAmount;
            
            return {
                regularPrice,
                offerPrice,
                discountAmount,
                bestOffer,
                offerType: productOffer >= categoryOffer ? 'Product Offer' : 'Category Offer'
            };
        };
        
        // Create a PDF document
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}${itemId ? '-item-' + itemId : ''}.pdf`);
        
        // Pipe the PDF directly to the response
        doc.pipe(res);
        
        // Add company logo or name
        doc.fontSize(20).text('Aromatique', { align: 'center' });
        doc.moveDown();
        
        // Add invoice title
        doc.fontSize(16).text('INVOICE', { align: 'center' });
        doc.moveDown();
        
        // Add order details
        doc.fontSize(12).text(`Invoice No: INV-${orderId}${itemId ? '-' + itemId.substring(0, 8) : ''}`);
        doc.text(`Order Date: ${order.orderDate}`);
        doc.text(`Order Status: ${itemId ? orderItem.itemStatus : order.status}`);
        doc.moveDown();
        
        // Add customer details
        doc.fontSize(14).text('Customer Details:');
        doc.fontSize(12).text(`Name: ${order.address.name}`);
        doc.text(`Address: ${order.address.address}`);
        doc.text(`Phone: ${order.address.phoneNumber}`);
        doc.text(`Pincode: ${order.address.pincode}`);
        doc.moveDown();
        
        // Add item details
        doc.fontSize(14).text('Order Items:');
        doc.moveDown(0.5);
        
        // Create table headers
        let yPos = doc.y;
        doc.fontSize(10);
        doc.text('Item', 50, yPos);
        doc.text('Volume', 200, yPos);
        doc.text('Qty', 260, yPos);
        doc.text('Regular Price', 300, yPos);
        doc.text('Offer Price', 380, yPos);
        doc.text('Total', 460, yPos);
        
        doc.moveTo(50, yPos + 15).lineTo(550, yPos + 15).stroke();
        doc.moveDown();
        
        // Add items to table
        let subtotalRegular = 0;
        let subtotalOffer = 0;
        let totalDiscount = 0;
        yPos = doc.y;
        
        // Filter items based on whether itemId is provided
        const itemsToProcess = itemId ? [orderItem] : order.items;
        
        itemsToProcess.forEach((item, index) => {
            const product = item.productId;
            const volume = item.volume;
            const quantity = item.quantity;
            
            // Find the variant with matching volume
            const variant = product.variants.find(v => v.volume === volume);
            const regularPrice = variant ? variant.regularPrice : 0;
            
            // Calculate offer pricing
            const pricing = calculateOfferPrice(product, volume, regularPrice);
            
            const regularTotal = regularPrice * quantity;
            const offerTotal = pricing.offerPrice * quantity;
            const itemDiscount = regularTotal - offerTotal;
            
            subtotalRegular += regularTotal;
            subtotalOffer += offerTotal;
            totalDiscount += itemDiscount;
            
            // Add item row to PDF
            const itemName = product.name.length > 25 ? product.name.substring(0, 25) + '...' : product.name;
            doc.fontSize(9);
            doc.text(itemName, 50, yPos, { width: 140 });
            doc.text(volume, 200, yPos);
            doc.text(quantity.toString(), 260, yPos);
            doc.text(`₹${regularPrice.toFixed(2)}`, 300, yPos);
            doc.text(`₹${pricing.offerPrice.toFixed(2)}`, 380, yPos);
            doc.text(`₹${offerTotal.toFixed(2)}`, 460, yPos);
            
            // Show offer information if there's a discount
            if (pricing.bestOffer > 0) {
                yPos += 12;
                doc.fontSize(8).fillColor('green');
                doc.text(`${pricing.offerType}: ${pricing.bestOffer}% off`, 50, yPos);
                doc.fillColor('black');
            }
            
            yPos += 20;
            
            // If we're running out of space on the page, add a new page
            if (yPos > 680) {
                doc.addPage();
                yPos = 50;
            }
        });
        
        // Add a line separator
        doc.moveTo(50, yPos + 5).lineTo(550, yPos + 5).stroke();
        yPos += 15;
        
        // Calculate additional discounts (system discount, coupon, etc.)
        let systemDiscount = 0;
        let couponDiscount = 0;
        
        if (itemId) {
            // For single item, calculate proportional discounts
            const itemProportion = subtotalOffer / order.total;
            systemDiscount = (order.systemDiscount || 0) * itemProportion;
            couponDiscount = (order.couponDiscount || 0) * itemProportion;
        } else {
            // For full order
            systemDiscount = order.systemDiscount || 0;
            couponDiscount = order.couponDiscount || 0;
        }
        
        const deliveryFee = itemId ? 0 : (order.shipping || 0);
        const finalTotal = subtotalOffer - systemDiscount - couponDiscount + deliveryFee;
        
        // Add pricing breakdown
        doc.fontSize(10);
        doc.text('Subtotal (Regular Price):', 350, yPos);
        doc.text(`₹${subtotalRegular.toFixed(2)}`, 470, yPos);
        yPos += 15;
        
        if (totalDiscount > 0) {
            doc.text('Offer Discount:', 350, yPos);
            doc.text(`-₹${totalDiscount.toFixed(2)}`, 470, yPos);
            yPos += 15;
        }
        
        doc.text('Subtotal (After Offers):', 350, yPos);
        doc.text(`₹${subtotalOffer.toFixed(2)}`, 470, yPos);
        yPos += 15;
        
        if (systemDiscount > 0) {
            doc.text('Additional Discount:', 350, yPos);
            doc.text(`-₹${systemDiscount.toFixed(2)}`, 470, yPos);
            yPos += 15;
        }
        
        if (couponDiscount > 0) {
            doc.text('Coupon Discount:', 350, yPos);
            doc.text(`-₹${couponDiscount.toFixed(2)}`, 470, yPos);
            yPos += 15;
        }
        
        if (deliveryFee > 0) {
            doc.text('Delivery Fee:', 350, yPos);
            doc.text(`₹${deliveryFee.toFixed(2)}`, 470, yPos);
            yPos += 15;
        }
        
        // Add a line before the total
        doc.moveTo(350, yPos).lineTo(550, yPos).stroke();
        yPos += 10;
        
        // Add total
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Total Amount:', 350, yPos);
        doc.text(`₹${finalTotal.toFixed(2)}`, 470, yPos);
        
        // Add savings summary
        const totalSavings = totalDiscount + systemDiscount + couponDiscount;
        if (totalSavings > 0) {
            yPos += 20;
            doc.fontSize(10).font('Helvetica').fillColor('green');
            doc.text(`Total Savings: ₹${totalSavings.toFixed(2)}`, 350, yPos);
            doc.fillColor('black');
        }
        
        // Add payment information
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica');
        doc.text('Payment Information:');
        doc.text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Payment Status: ${itemId ? orderItem.paymentStatus || order.paymentStatus : order.paymentStatus}`);
        
        // Add coupon information if used
        if (order.couponUsed) {
            doc.text(`Coupon Used: ${order.couponUsed}`);
        }
        
        // Add footer with terms
        doc.fontSize(10);
        doc.text('Thank you for shopping with us!', 50, 700);
        doc.text('For any queries related to this invoice, please contact our support.', 50, 715);
        
        // Finalize the PDF
        doc.end();
        
    } catch (error) {
        console.log(error.message);
        res.status(500).render("error", { 
            message: "Failed to generate invoice" 
        });
    }
}


}

module.exports=orderController