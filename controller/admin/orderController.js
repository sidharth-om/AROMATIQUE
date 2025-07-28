const Order = require("../../models/orderModel");
const walletTransaction = require("../../models/walletTransactionModel");
const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');



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

      console.log("ordd",orders)

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


   generateSalesReport: async (req, res) => {
    try {
      const { reportType = 'daily', dateFrom, dateTo, format } = req.query; // Default to 'daily'
      console.log('Query Parameters:', req.query); // Debug log

      // Build date filter based on report type
      const filter = {};
      let dateLabel = '';
      const now = new Date();
      now.setHours(23, 59, 59, 999); // End of day

      if (reportType === 'daily') {
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          $lte: now
        };
        dateLabel = `Daily Report - ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      } else if (reportType === 'weekly') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);
        filter.createdAt = {
          $gte: startOfWeek,
          $lte: now
        };
        dateLabel = `Weekly Report - ${startOfWeek.toLocaleDateString('en-US')} to ${now.toLocaleDateString('en-US')}`;
      } else if (reportType === 'yearly') {
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), 0, 1), // Start of year
          $lte: now
        };
        dateLabel = `Yearly Report - ${now.getFullYear()}`;
      } else if (reportType === 'custom') {
        if (!dateFrom || !dateTo) {
          return res.status(400).json({ success: false, message: 'Date range required for custom report' });
        }
        filter.createdAt = {
          $gte: new Date(dateFrom),
          $lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999))
        };
        dateLabel = `Custom Report - ${new Date(dateFrom).toLocaleDateString('en-US')} to ${new Date(dateTo).toLocaleDateString('en-US')}`;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid report type' });
      }

      // MongoDB aggregation pipeline for sales report
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userId'
          }
        },
        { $unwind: '$userId' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'populatedProducts'
          }
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: '$total' },
            totalOfferDiscount: { $sum: '$offerDiscount' },
            totalSystemDiscount: { $sum: '$systemDiscount' },
            totalCouponDiscount: { $sum: '$couponDiscount' },
            totalShipping: { $sum: '$shipping' },
            orders: { $push: '$$ROOT' }
          }
        },
        {
          $project: {
            totalOrders: 1,
            totalAmount: 1,
            totalOfferDiscount: 1,
            totalSystemDiscount: 1,
            totalCouponDiscount: 1,
            totalShipping: 1,
            totalDiscount: {
              $sum: ['$totalOfferDiscount', '$totalSystemDiscount', '$totalCouponDiscount']
            },
            orders: 1
          }
        }
      ];

      const [reportData] = await Order.aggregate(pipeline);

      // Default empty report if no data
      const report = reportData || {
        totalOrders: 0,
        totalAmount: 0,
        totalOfferDiscount: 0,
        totalSystemDiscount: 0,
        totalCouponDiscount: 0,
        totalShipping: 0,
        totalDiscount: 0,
        orders: []
      };

      // Populate product details for orders
      await Order.populate(report.orders, [
        { path: 'items.productId', select: 'name images variants' },
        { path: 'address' }
      ]);

      // Handle PDF or Excel download
      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 50 });
        let filename = `sales_report_${reportType}_${Date.now()}.pdf`;
        filename = encodeURIComponent(filename);
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        // PDF Header
        doc.fontSize(20).text('Aromatique Sales Report', { align: 'center' });
        doc.fontSize(14).text(dateLabel, { align: 'center' });
        doc.moveDown();

        // Summary Table
        doc.fontSize(12).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.text(`Total Orders: ${report.totalOrders}`);
        doc.text(`Total Sales Amount: ₹${report.totalAmount.toFixed(2)}`);
        doc.text(`Total Offer Discount: ₹${report.totalOfferDiscount.toFixed(2)}`);
        doc.text(`Total System Discount: ₹${report.totalSystemDiscount.toFixed(2)}`);
        doc.text(`Total Coupon Discount: ₹${report.totalCouponDiscount.toFixed(2)}`);
        doc.text(`Total Discount: ₹${report.totalDiscount.toFixed(2)}`);
        doc.text(`Total Shipping: ₹${report.totalShipping.toFixed(2)}`);
        doc.moveDown();

     // Draw Table Headers
doc.fontSize(12).text('Order Details', { underline: true });
doc.moveDown(0.5);

// Define starting X and Y
const tableTop = doc.y + 10;
const itemX = 50;
const colWidths = [100, 150, 100, 120, 100]; // Widths for each column

// Headers
const headers = ['Order ID', 'Customer', 'Total', 'Coupon Used', 'Status'];
headers.forEach((header, i) => {
  doc.text(header, itemX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, { bold: true });
});

// Horizontal line under header
doc.moveTo(itemX, tableTop + 15)
   .lineTo(itemX + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
   .stroke();

// Table rows
let rowY = tableTop + 25;
report.orders.forEach((order) => {
  const values = [
    order.orderId,
    order.userId.fullname,
    `₹${order.total.toFixed(2)}`,
    order.couponUsed || 'None',
    order.status
  ];

  values.forEach((text, i) => {
    doc.text(text, itemX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), rowY);
  });

  rowY += 20;

  // Page break logic if needed
  if (rowY >= doc.page.height - 100) {
    doc.addPage();
    rowY = 50;
  }
});


        doc.pipe(res);
        doc.end();
        return;
      } else if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Excel Header
        worksheet.addRow(['Aromatique Sales Report']);
        worksheet.addRow([dateLabel]);
        worksheet.addRow([]);

        // Summary Table
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Metric', 'Value']);
        worksheet.addRow(['Total Orders', report.totalOrders]);
        worksheet.addRow(['Total Sales Amount', `₹${report.totalAmount.toFixed(2)}`]);
        worksheet.addRow(['Total Offer Discount', `₹${report.totalOfferDiscount.toFixed(2)}`]);
        worksheet.addRow(['Total System Discount', `₹${report.totalSystemDiscount.toFixed(2)}`]);
        worksheet.addRow(['Total Coupon Discount', `₹${report.totalCouponDiscount.toFixed(2)}`]);
        worksheet.addRow(['Total Discount', `₹${report.totalDiscount.toFixed(2)}`]);
        worksheet.addRow(['Total Shipping', `₹${report.totalShipping.toFixed(2)}`]);
        worksheet.addRow([]);

        // Orders Table
        if (report.orders.length > 0) {
          worksheet.addRow(['Order Details']);
          worksheet.addRow(['Order ID', 'Customer', 'Total', 'Coupon Used', 'Status']);
          report.orders.forEach(order => {
            worksheet.addRow([
              order.orderId,
              order.userId.fullname,
              `₹${order.total.toFixed(2)}`,
              order.couponUsed || 'None',
              order.status
            ]);
          });
        }

        // Styling
        worksheet.getRow(1).font = { size: 16, bold: true };
        worksheet.getRow(2).font = { size: 12 };
        worksheet.getRow(4).font = { bold: true };
        worksheet.getRow(10).font = { bold: true };
        worksheet.columns.forEach(column => {
          column.width = 20;
        });

        let filename = `sales_report_${reportType}_${Date.now()}.xlsx`;
        filename = encodeURIComponent(filename);
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      // Render the sales report page
      res.render('admin/salesReport', {
        report: report,
        reportType: reportType,
        dateFrom: dateFrom || '',
        dateTo: dateTo || '',
        dateLabel
      });
    } catch (error) {
      console.log('Error in generateSalesReport:', error.message);
      res.status(500).render('error', {
        message: 'Failed to generate sales report. Please try again later.'
      });
    }
  },

 updateStatus: async (req, res) => {
  try {
    const { orderId, status, reason } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, message: 'Order ID and status are required' });
    }

    const order = await Order.findOne({ orderId: orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updateData = { 
      status: status,
      // Update all items' statuses to match the order status
      $set: { 'items.$[].itemStatus': status }
    };

    if (status === 'delivered') {
      updateData.deliveredDate = new Date();
    }

    if (status === 'return request') {
      updateData['returnRequest.isRequested'] = true;
      updateData['returnRequest.requestedAt'] = new Date();
      updateData['returnRequest.reason'] = reason || 'Admin-initiated return';
      // Set reason for all items if provided
      if (reason) {
        updateData.$set['items.$[].reason'] = reason;
      }
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderId },
      updateData,
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

    const order = await Order.findOne({ orderId: orderId })
      .populate("items.productId")
      .populate("address")
      .populate("userId");

    if (!order) {
      return res.status(404).render("error", { message: "Order not found" });
    }

    const orderItem = order.items[productIndex];
    if (!orderItem) {
      return res.status(404).render("error", { message: "Product not found in this order" });
    }

    // Fetch the product and its category to compare discounts
    const product = await Product.findById(productId).populate("categoryId");
    if (!product) {
      return res.status(404).render("error", { message: "Product not found" });
    }

    // Calculate offer discount: compare product.offer and category.offer
    const productOffer = product.offer || 0;
    const categoryOffer = product.categoryId.offer || 0;
    const offerDiscount = Math.max(productOffer, categoryOffer);

    // Calculate per-item coupon discount
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const couponDiscount = order.couponDiscount
      ? (order.couponDiscount / totalItems).toFixed(2)
      : 0;

    // Get shipping charge
    const shippingCharge = order.shipping || 0;

    // Calculate subtotal, discount, and total amount
    let subtotal = 0;
    const quantity = orderItem.quantity;
    const variant = product.variants.find(v => v.volume === orderItem.volume);
    const regularPrice = variant ? variant.regularPrice : orderItem.itemSalePrice;
    subtotal = regularPrice * quantity;

    // Apply offer discount to calculate effective price
    const offerDiscountAmount = (subtotal * offerDiscount) / 100;
    const itemSubtotalAfterOffer = subtotal - offerDiscountAmount;

    // Apply per-item coupon discount
    const itemCouponDiscount = parseFloat(couponDiscount) * quantity;
    let totalAmount = itemSubtotalAfterOffer - itemCouponDiscount + shippingCharge;

    // Ensure totalAmount is not negative
    totalAmount = Math.max(totalAmount, 0).toFixed(2);

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const viewData = {
      index: productIndex,
      product: orderItem.productId,
      currentDate: currentDate,
      customer: {
        address: order.address,
        phone: order.address.mobile,
      },
    };

    res.render("admin/viewOrderDetails", {
      viewData,
      subtotal: subtotal.toFixed(2),
      offerDiscount: Math.round(offerDiscountAmount.toFixed(2)),
      couponDiscount: Math.round(itemCouponDiscount.toFixed(2)),
      shipping: Math.round(shippingCharge.toFixed(2)),
      totalAmount:Math.round(totalAmount),
      productId,
      order,
      orderItem,
      orderId,
    });

    console.log("subtotal", subtotal, "offerDiscount", offerDiscountAmount, "couponDiscount", itemCouponDiscount, "shipping", shippingCharge, "totalAmount", totalAmount);
    console.log("orderItem::", orderItem);
    console.log("orderrtt::", order);
  } catch (error) {
    console.log(error.message);
    res.status(500).render("error", { message: "Server error" });
  }
},
};

module.exports = orderController;

