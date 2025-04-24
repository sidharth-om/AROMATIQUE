const Order=require("../../models/orderModel")
const User=require("../../models/userModel")
const Cart=require("../../models/cartModel")
const PDFDocument = require('pdfkit')

const orderController={

    myOrders:async (req,res) => {
        try {

            const userId=req.session.user.userId
            // const orders=await Order.findOne({userId}).populate("items.productId")
            const orders = await Order.find({ userId }).populate("items.productId").sort({orderDate:-1});

            // console.log("orderrrrrrr",orders)

            const email=req.session.user.email
            const user=await User.findOne({email:email})
             const cart=await Cart.findOne({userId})
            res.render("user/myOrders",{orders,user,cart})
        } catch (error) {
            console.log(error.message)
        }
    },
    viewOrder: async (req, res) => {
        try {
            const { orderId, itemIndex } = req.params;
            const index = parseInt(itemIndex);
            const userId=req.session.user.userId
            
            // Find the order by its orderId field (not MongoDB _id)
            const order = await Order.findOne({ orderId: orderId ,})
                .populate("items.productId")
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
            let discount=0
            if(subtotal>1000){
                discount=40
            }
            let totalAmount=subtotal-discount

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
                    // Other pricing details...
                }
            };
            
             const cart=await Cart.findOne({userId})

            const email=req.session.user.email
            const user=await User.findOne({email:email})
            res.render("user/viewOrder", {viewData,subtotal,discount,totalAmount,user,cart});
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
          const { orderId, itemId } = req.params; // Add itemId parameter
          const userId = req.session.user.userId;
          
          // Find the order
          const order = await Order.findOne({ orderId: orderId, userId: userId })
            .populate("items.productId")
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
          doc.text('Quantity', 300, yPos);
          doc.text('Price', 400, yPos);
          doc.text('Total', 470, yPos);
          
          doc.moveTo(50, yPos + 15).lineTo(550, yPos + 15).stroke();
          doc.moveDown();
          
          // Add items to table - either just the specific item or all items
          let subtotal = 0;
          yPos = doc.y;
          
          // Filter items based on whether itemId is provided
          const itemsToProcess = itemId ? [orderItem] : order.items;
          
          itemsToProcess.forEach((item, index) => {
            const itemName = item.productId.name;
            const quantity = item.quantity;
            const price = item.itemSalePrice || item.productId.variants[0].regularPrice;
            const total = price * quantity;
            
            subtotal += total;
            
            doc.text(itemName, 50, yPos, { width: 240 });
            doc.text(quantity.toString(), 300, yPos);
            doc.text(`₹${price.toFixed(2)}`, 400, yPos);
            doc.text(`₹${total.toFixed(2)}`, 470, yPos);
            
            yPos += 20;
            
            // If we're running out of space on the page, add a new page
            if (yPos > 700) {
              doc.addPage();
              yPos = 50;
            }
          });
          
          // Add a line separator
          doc.moveTo(50, yPos + 5).lineTo(550, yPos + 5).stroke();
          yPos += 15;
          
          // Calculate totals - adjust for single item if necessary
          let discount = 0;
          if (itemId) {
            // For single item, calculate proportional discount or use item-specific discount
            if (orderItem.discount) {
              discount = orderItem.discount;
            } else if (subtotal > 1000) {
              discount = 40;
            }
          } else {
            // For full order
            if (subtotal > 1000) {
              discount = 40;
            }
          }
          
          // Calculate proportional delivery fee and tax for single item if needed
          const deliveryFee = itemId ? 0 : (order.deliveryFee || 0); // Usually don't charge delivery fee again for single item
          const tax = itemId ? (subtotal * 0.18) : (order.tax || 0); // Example: 18% tax
          const totalAmount = subtotal - discount + deliveryFee + tax;
          
          // Add totals
          doc.fontSize(10);
          doc.text('Subtotal:', 350, yPos);
          doc.text(`₹${subtotal.toFixed(2)}`, 470, yPos);
          yPos += 15;
          
          doc.text('Discount:', 350, yPos);
          doc.text(`₹${discount.toFixed(2)}`, 470, yPos);
          yPos += 15;
          
          if (deliveryFee > 0) {
            doc.text('Delivery Fee:', 350, yPos);
            doc.text(`₹${deliveryFee.toFixed(2)}`, 470, yPos);
            yPos += 15;
          }
          
          if (tax > 0) {
            doc.text('Tax:', 350, yPos);
            doc.text(`₹${tax.toFixed(2)}`, 470, yPos);
            yPos += 15;
          }
          
          // Add a line before the total
          doc.moveTo(350, yPos).lineTo(550, yPos).stroke();
          yPos += 10;
          
          // Add total
          doc.fontSize(12).font('Helvetica-Bold');
          doc.text('Total Amount:', 350, yPos);
          doc.text(`₹${totalAmount.toFixed(2)}`, 470, yPos);
          
          // Add payment information
          doc.moveDown(2);
          doc.fontSize(10).font('Helvetica');
          doc.text('Payment Information:');
          doc.text(`Payment Method: ${order.paymentMethod}`);
          doc.text(`Payment Status: ${itemId ? orderItem.paymentStatus || order.paymentStatus : order.paymentStatus}`);
          
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