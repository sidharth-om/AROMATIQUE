const Order=require("../../models/orderModel")
const walletTransaction=require("../../models/walletTransactionModel")
const Product=require("../../models/productModel")
const User=require("../../models/userModel")

const orderController={

    loadOrderList:async (req,res) => {
        try {

            const orders=await Order.find().populate("items.productId").populate("userId");
            console.log("ordddeeerr::",orders)
            res.render("admin/order",{orders})
        } catch (error) {
            console.log(error.message)
        }
    },
    updateStatus:async (req,res) => {
        try {
            const {orderId,status}=req.body

            if (!orderId || !status) {
                return res.status(400).json({ success: false, message: 'Order ID and status are required' });
              }

              const order = await Order.findOne({ orderId: orderId });

              if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
              }

              const updateData = { status: status };

              if (status === 'delivered') {
                updateData.deliveredDate = new Date();
              }

              if (status === 'return request') {
                updateData['returnRequest.isRequested'] = true;
                updateData['returnRequest.requestedAt'] = new Date();
                
                // If reason was provided
                if (req.body.reason) {
                  updateData['returnRequest.reason'] = req.body.reason;
                }
              }

              const updatedOrder = await Order.findOneAndUpdate(
                { orderId: orderId },
                { $set: updateData },
                { new: true }
              );
              
              // Log status change for audit
              console.log(`Order #${orderId} status changed to ${status} by admin`);
              
              // Return success response
              return res.status(200).json({ 
                success: true, 
                message: 'Order status updated successfully',
                order: updatedOrder
              });

        } catch (error) {
            console.log(error.message)
        }
    },
    updateItemStatus:async (req,res) => {
        try {
            
            const { orderId, productId, status, reason } = req.body;
            if (!orderId || !productId || !status) {
                return res.status(400).json({ 
                  success: false, 
                  message: 'Order ID, product ID, and status are required' 
                });
              }

              const order = await Order.findOne({ orderId: orderId });

              if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
              }

              const itemIndex = order.items.findIndex(item => 
                item.productId.toString() === productId
              );

              if (itemIndex === -1) {
                return res.status(404).json({ success: false, message: 'Product not found in order' });
              }
              
              // Prepare update data
              const updateQuery = {
                $set: { [`items.${itemIndex}.itemStatus`]: status }
              };
              
              // Add reason if provided and status is return request
              if (status === 'return request' && reason) {
                updateQuery.$set[`items.${itemIndex}.reason`] = reason;
              }

              const updatedOrder = await Order.findOneAndUpdate(
                { orderId: orderId },
                updateQuery,
                { new: true }
              );

              const allSameStatus = updatedOrder.items.every(item => item.itemStatus === status);
              if (allSameStatus) {
                updatedOrder.status = status;
                
                // For delivered status, update the deliveredDate
                if (status === 'delivered') {
                  updatedOrder.deliveredDate = new Date();
                }
                
                // For return request, update return request info
                if (status === 'return request') {
                  updatedOrder.returnRequest = {
                    isRequested: true,
                    reason: reason || 'Item return requested',
                    requestedAt: new Date()
                  };
                }

                
                
                await updatedOrder.save();
              }

              const item=order.items[itemIndex]

              const refundAmount=item.itemSalePrice * item.quantity

              if(status==='returned'){
                try{
                  const product=await Product.findById(productId)

                  if(product && product.variants && product.variants.length>0){
                    const itemVolume=item.volume || item.variant || item.variantVolume

                    let variantIndex=-1

                    if(itemVolume){
                      variantIndex=product.variants.findIndex(variant=>
                        variant.volume===itemVolume
                      )
                    }

                    if(variantIndex===-1){
                      console.log(`Couldn't find exact variant match for product ${productId}, using first variant as fallback`)
                      variantIndex=0
                    }

                    product.variants[variantIndex].quantity+=item.quantity

                    await product.save()

                    console.log(`Product ${productId}, variant ${product.variants[variantIndex].volume}, quantity increased by ${item.quantity} due to return`);

                    
                  }
                  else{
                    console.log(`Product ${productId} has no variants, cannot update quantity`);
                  }
                }
                catch(error){
                  console.log(`Error updating product quantity: ${error.message}`);
                }
              }




              const existingRefund=await walletTransaction.findOne({
                userId:order.userId,
                reference:orderId,
                type:'refund'
              })

// In orderController.js, within the updateItemStatus function
// After confirming no existing refund exists:

if (!existingRefund && status === 'returned') {
  // Create transaction record
  const WalletTransaction = new walletTransaction({
    userId: order.userId,
    transactionId: 'TXN' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    productId: productId,
    amount: refundAmount,
    type: 'refund',
    status: 'success',
    reference: orderId,
    description: `Refund for returned item in order #${orderId}`
  });

  // Update user's wallet balance in User model
  const user = await User.findById(order.userId);
  if (!user) {
    console.log(`User not found for userId: ${order.userId}`);
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Update user's wallet balance
  user.wallet.balance += refundAmount;
  user.wallet.lastUpdated = new Date();
  await user.save();
  
  // Save the new balance in the transaction for record-keeping
  WalletTransaction.wallet.balance = user.wallet.balance;
  await WalletTransaction.save();
  
  console.log(`Refund of ${refundAmount} added to user wallet. New balance: ${user.wallet.balance}`);
} else {
  console.log("Refund already exists for this order item, skipping duplicate refund");
}



                // Log the change
            console.log(`Order #${orderId}, product ${productId} status changed to ${status}`);
            
            // Return success
            return res.status(200).json({ 
            success: true, 
            message: 'Item status updated successfully',
            order: updatedOrder
            });
    
        } catch (error) {
            console.log(error.message)
        }
    },
    viewDetails:async (req,res) => {
        try {
            
            const {orderId,itemIndex}=req.params
            const index=parseInt(itemIndex)

            console.log("index",index)

            const order=await Order.findOne({orderId:orderId}).populate("items.productId").populate("address")

            if (!order) {
                return res.status(404).render("error", { 
                    message: "Order not found" 
                });
            }

            const orderItem = order.items[index];

            console.log("orderitem::",orderItem)
            
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

            const otherItems = order.items.filter((item, idx) => idx !== index);

            const currentDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            });

            const itemPrice = orderItem.itemSalePrice || 0;

            const viewData = {
                index:index,
                order: order,
                product: orderItem.productId,
                orderItem: orderItem,
                currentDate: currentDate,
                customer: {
                    // name: req.session.user.name || "Customer",
                    address: order.address,
                    phone: order.address.mobile
                },
                pricing: {
                    // Calculate any pricing information needed by your view
                    totalAmount: order.total,
                    // Other pricing details...
                }
            };

            console.log("adminorder::",order)

            res.render("admin/viewOrderDetails",{viewData,subtotal,discount,totalAmount})
        } catch (error) {
            console.log(error.message)
        }
    },
    orderDetail:async (req,res) => {
        try {
            const { orderId, productIndex, productId } = req.query;

            // const userId=req.session.user.userId

            console.log("orderid:",orderId,"productIndex:",productIndex,"productId",productId)

            const order=await Order.findOne({orderId:orderId}).populate("items.productId").populate("address").populate("userId")

            const orderItem = order.items[productIndex];

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

            const currentDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            });


            const viewData = {
                index:productIndex,
                
                product: orderItem.productId,
               
                currentDate: currentDate,
                customer: {
                    // name: req.session.user.name || "Customer",
                    address: order.address,
                    phone: order.address.mobile
                }
                
            };

            res.render("admin/viewOrderDetails",{viewData,subtotal,discount,totalAmount,productId,order,orderItem,orderId})

            console.log("subtotal",subtotal,"discount",discount,"totalAmount",totalAmount)

            console.log("orderItem::",orderItem)

            console.log("orderrtt::",order)


            // console.log("orrddeerr:::::",order)
            // console.log("orderitem::",orderItem)
        } catch (error) {
            console.log(error.message)
        }
    },
   
}

module.exports=orderController