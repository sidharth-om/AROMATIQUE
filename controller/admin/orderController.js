const Order = require("../../models/orderModel");
const walletTransaction = require("../../models/walletTransactionModel");
const Product = require("../../models/productModel");
const User = require("../../models/userModel");

const orderController = {
  loadOrderList: async (req, res) => {
    try {
      const { 
        search, 
        sortBy = 'createdAt', 
        sortOrder = 'desc', 
        status, 
        page = 1, 
        limit = 10,
        paymentMethod,
        dateFrom,
        dateTo
      } = req.query;

      // Build the query filter
      const filter = {};
      
      // Search functionality - improved to search in multiple fields
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        filter.$or = [
          { orderId: searchRegex },
          { 'userId.fullname': searchRegex },
          { 'items.productId.name': searchRegex }
        ];
      }

      // Status filter
      if (status && status.trim()) {
        filter.status = status;
      }

      // Payment method filter
      if (paymentMethod && paymentMethod.trim()) {
        filter.paymentMethod = paymentMethod;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) {
          filter.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999); // Include the entire day
          filter.createdAt.$lte = endDate;
        }
      }

      // Build sort object
      const sort = {};
      const allowedSortFields = ['createdAt', 'total', 'orderId', 'status'];
      if (allowedSortFields.includes(sortBy)) {
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sort.createdAt = -1; // Default sort
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10)); // Limit between 1-50
      const skip = (pageNum - 1) * limitNum;

      // Build aggregation pipeline for better search across populated fields
      const pipeline = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userId'
          }
        },
        {
          $unwind: '$userId'
        },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'populatedProducts'
          }
        }
      ];

      // Add match stage if there are filters
      if (Object.keys(filter).length > 0) {
        // Handle search across populated fields
        if (filter.$or) {
          const matchConditions = [];
          
          // Search in orderId
          if (search) {
            const searchRegex = new RegExp(search.trim(), 'i');
            matchConditions.push({ orderId: searchRegex });
            matchConditions.push({ 'userId.fullname': searchRegex });
            matchConditions.push({ 'populatedProducts.name': searchRegex });
          }
          
          pipeline.push({
            $match: {
              $and: [
                ...(matchConditions.length > 0 ? [{ $or: matchConditions }] : []),
                ...(status ? [{ status: status }] : []),
                ...(paymentMethod ? [{ paymentMethod: paymentMethod }] : []),
                ...(filter.createdAt ? [{ createdAt: filter.createdAt }] : [])
              ].filter(condition => Object.keys(condition).length > 0)
            }
          });
        } else {
          // Remove $or from filter for direct match
          const { $or, ...directFilter } = filter;
          if (Object.keys(directFilter).length > 0) {
            pipeline.push({ $match: directFilter });
          }
        }
      }

      // Add sort stage
      pipeline.push({ $sort: sort });

      // Get total count for pagination
      const countPipeline = [...pipeline, { $count: "total" }];
      const countResult = await Order.aggregate(countPipeline);
      const totalOrders = countResult.length > 0 ? countResult[0].total : 0;

      // Add pagination stages
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });

      // Execute aggregation
      const orders = await Order.aggregate(pipeline);

      // Populate the remaining fields that weren't handled in aggregation
      await Order.populate(orders, [
        {
          path: 'items.productId',
          select: 'name images variants'
        }
      ]);

      // Calculate total pages
      const totalPages = Math.ceil(totalOrders / limitNum);

      // Get unique statuses and payment methods for filter dropdowns
      const statusOptions = await Order.distinct('status');
      const paymentMethodOptions = await Order.distinct('paymentMethod');

      // Log for debugging
      console.log('Query Params:', { search, sortBy, sortOrder, status, page, limit, paymentMethod, dateFrom, dateTo });
      console.log('MongoDB Filter:', JSON.stringify(filter, null, 2));
      console.log('MongoDB Sort:', JSON.stringify(sort, null, 2));
      console.log('Pagination:', { pageNum, limitNum, totalOrders, totalPages });

      res.render("admin/order", {
        orders,
        search: search || '',
        sortBy,
        sortOrder,
        status: status || '',
        paymentMethod: paymentMethod || '',
        dateFrom: dateFrom || '',
        dateTo: dateTo || '',
        currentPage: pageNum,
        totalPages,
        limit: limitNum,
        totalOrders,
        statusOptions,
        paymentMethodOptions
      });
    } catch (error) {
      console.log('Error in loadOrderList:', error.message);
      res.status(500).render("error", {
        message: "Failed to load orders. Please try again later."
      });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { orderId, status } = req.body;

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
        
        if (req.body.reason) {
          updateData['returnRequest.reason'] = req.body.reason;
        }
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { orderId: orderId },
        { $set: updateData },
        { new: true }
      );
      
      console.log(`Order #${orderId} status changed to ${status} by admin`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Order status updated successfully',
        order: updatedOrder
      });
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  updateItemStatus: async (req, res) => {
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
      
      const updateQuery = {
        $set: { [`items.${itemIndex}.itemStatus`]: status }
      };
      
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
        
        if (status === 'delivered') {
          updatedOrder.deliveredDate = new Date();
        }
        
        if (status === 'return request') {
          updatedOrder.returnRequest = {
            isRequested: true,
            reason: reason || 'Item return requested',
            requestedAt: new Date()
          };
        }
        
        await updatedOrder.save();
      }

      const item = order.items[itemIndex];
      const refundAmount = item.itemSalePrice * item.quantity;

      if (status === 'returned') {
        try {
          const product = await Product.findById(productId);

          if (product && product.variants && product.variants.length > 0) {
            const itemVolume = item.volume || item.variant || item.variantVolume;
            let variantIndex = -1;

            if (itemVolume) {
              variantIndex = product.variants.findIndex(variant => variant.volume === itemVolume);
            }

            if (variantIndex === -1) {
              console.log(`Couldn't find exact variant match for product ${productId}, using first variant as fallback`);
              variantIndex = 0;
            }

            product.variants[variantIndex].quantity += item.quantity;
            await product.save();

            console.log(`Product ${productId}, variant ${product.variants[variantIndex].volume}, quantity increased by ${item.quantity} due to return`);
          } else {
            console.log(`Product ${productId} has no variants, cannot update quantity`);
          }
        } catch (error) {
          console.log(`Error updating product quantity: ${error.message}`);
        }
      }

      const existingRefund = await walletTransaction.findOne({
        userId: order.userId,
        reference: orderId,
        type: 'refund'
      });

      if (!existingRefund && status === 'returned') {
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

        const user = await User.findById(order.userId);
        if (!user) {
          console.log(`User not found for userId: ${order.userId}`);
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.wallet.balance += refundAmount;
        user.wallet.lastUpdated = new Date();
        await user.save();
        
        WalletTransaction.wallet.balance = user.wallet.balance;
        await WalletTransaction.save();
        
        console.log(`Refund of ${refundAmount} added to user wallet. New balance: ${user.wallet.balance}`);
      } else {
        console.log("Refund already exists for this order item, skipping duplicate refund");
      }

      console.log(`Order #${orderId}, product ${productId} status changed to ${status}`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Item status updated successfully',
        order: updatedOrder
      });
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  viewDetails: async (req, res) => {
    try {
      const { orderId, itemIndex } = req.params;
      const index = parseInt(itemIndex);

      console.log("index", index);

      const order = await Order.findOne({ orderId: orderId }).populate("items.productId").populate("address");

      if (!order) {
        return res.status(404).render("error", { 
          message: "Order not found" 
        });
      }

      const orderItem = order.items[index];

      console.log("orderitem::", orderItem);
      
      if (!orderItem) {
        return res.status(404).render("error", { 
          message: "Product not found in this order" 
        });
      }
      
      let subtotal = 0;
      const quantity = orderItem.quantity;
      orderItem.productId.variants.forEach(item => {
        const price = item.regularPrice;
        subtotal += price * quantity;
      });
      let discount = 0;
      if (subtotal > 1000) {
        discount = 40;
      }
      let totalAmount = subtotal - discount;

      const otherItems = order.items.filter((item, idx) => idx !== index);

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });

      const itemPrice = orderItem.itemSalePrice || 0;

      const viewData = {
        index: index,
        order: order,
        product: orderItem.productId,
        orderItem: orderItem,
        currentDate: currentDate,
        customer: {
          address: order.address,
          phone: order.address.mobile
        },
        pricing: {
          totalAmount: order.total
        }
      };

      console.log("adminorder::", order);

      res.render("admin/viewOrderDetails", { viewData, subtotal, discount, totalAmount });
    } catch (error) {
      console.log(error.message);
      res.status(500).render("error", { message: "Server error" });
    }
  },

  orderDetail: async (req, res) => {
    try {
      const { orderId, productIndex, productId } = req.query;
      console.log("orderid:", orderId, "productIndex:", productIndex, "productId", productId);

      const order = await Order.findOne({ orderId: orderId }).populate("items.productId").populate("address").populate("userId");

      const orderItem = order.items[productIndex];

      if (!orderItem) {
        return res.status(404).render("error", { 
          message: "Product not found in this order" 
        });
      }

      let subtotal = 0;
      const quantity = orderItem.quantity;
      orderItem.productId.variants.forEach(item => {
        const price = item.regularPrice;
        subtotal += price * quantity;
      });
      let discount = 0;
      if (subtotal > 1000) {
        discount = 40;
      }
      let totalAmount = subtotal - discount;

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });

      const viewData = {
        index: productIndex,
        product: orderItem.productId,
        currentDate: currentDate,
        customer: {
          address: order.address,
          phone: order.address.mobile
        }
      };

      res.render("admin/viewOrderDetails", { 
        viewData, 
        subtotal, 
        discount, 
        totalAmount, 
        productId, 
        order, 
        orderItem, 
        orderId 
      });

      console.log("subtotal", subtotal, "discount", discount, "totalAmount", totalAmount);
      console.log("orderItem::", orderItem);
      console.log("orderrtt::", order);
    } catch (error) {
      console.log(error.message);
      res.status(500).render("error", { message: "Server error" });
    }
  }
};

module.exports = orderController;