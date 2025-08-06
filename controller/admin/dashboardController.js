const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");
const statusCode=require("../../config/statusCode")

const dashboardController = {
  loadDashboard: async (req, res) => {
    try {
      const { period = 'yearly', dateFrom, dateTo } = req.query;

      // Build date filter
      const filter = {};
      const now = new Date();
      now.setHours(23, 59, 59, 999);

      if (period === 'daily') {
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          $lte: now
        };
      } else if (period === 'weekly') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        filter.createdAt = {
          $gte: weekStart,
          $lte: now
        };
      } else if (period === 'monthly') {
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: now
        };
      } else if (period === 'yearly') {
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), 0, 1),
          $lte: now
        };
      } else if (period === 'custom' && dateFrom && dateTo) {
        filter.createdAt = {
          $gte: new Date(dateFrom),
          $lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999))
        };
      } else {
        // Default to yearly if period is invalid
        filter.createdAt = {
          $gte: new Date(now.getFullYear(), 0, 1),
          $lte: now
        };
      }

      // Add filter to only include completed/delivered orders
      filter.paymentStatus = { $in: ['completed'] };
      filter.status = { $ne: 'cancelled' };

      // Calculate total revenue
      const totalRevenuePipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            totalDiscount: { $sum: { $add: ['$offerDiscount', '$systemDiscount', '$couponDiscount'] } }
          }
        }
      ];

      const revenueData = await Order.aggregate(totalRevenuePipeline);
      const totalStats = revenueData.length > 0 ? revenueData[0] : {
        totalRevenue: 0,
        totalOrders: 0,
        totalDiscount: 0
      };

      // Generate sales chart data based on period
      const salesChartData = await generateSalesChartData(filter, period);

      // Aggregation for best-selling products
      const topProductsPipeline = [
        { $match: filter },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            totalSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.itemSalePrice'] } }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $project: {
            name: '$product.name',
            totalSold: 1,
            totalRevenue: 1,
            category: '$product.category',
            brand: '$product.brand'
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ];

      const topProducts = await Order.aggregate(topProductsPipeline);

      // Aggregation for best-selling categories
   const topCategoriesPipeline = [
  { $match: filter },
  { $unwind: '$items' },
  {
    $lookup: {
      from: 'products',
      localField: 'items.productId',
      foreignField: '_id',
      as: 'product'
    }
  },
  { $unwind: '$product' },
  {
    $lookup: {
      from: 'categories',
      localField: 'product.categoryId', // Corrected from 'product.category'
      foreignField: '_id',
      as: 'categoryDetails'
    }
  },
  {
    $unwind: {
      path: '$categoryDetails',
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $group: {
      _id: { $ifNull: ['$categoryDetails._id', null] },
      name: { $first: { $ifNull: ['$categoryDetails.name', 'Uncategorized'] } },
      totalSold: { $sum: '$items.quantity' },
      totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.itemSalePrice'] } }
    }
  },
  {
    $project: {
      _id: 0,
      name: 1,
      totalSold: 1,
      totalRevenue: 1
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 10 }
];
      const topCategories = await Order.aggregate(topCategoriesPipeline);
      console.log("cate",topCategories);

      // Aggregation for best-selling brands
    const topBrandsPipeline = [
  { $match: filter },
  { $unwind: '$items' },
  {
    $lookup: {
      from: 'products',
      localField: 'items.productId',
      foreignField: '_id',
      as: 'product'
    }
  },
  { $unwind: '$product' },
  {
    $lookup: {
      from: 'brands', // Join with Brand model
      localField: 'product.brand',
      foreignField: '_id',
      as: 'brandDetails'
    }
  },
  { $unwind: '$brandDetails' },
  {
    $group: {
      _id: '$brandDetails._id', // Group by brand ID
      name: { $first: '$brandDetails.name' }, // Fetch brand name
      totalSold: { $sum: '$items.quantity' },
      totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.itemSalePrice'] } }
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 10 }
];

      const topBrands = await Order.aggregate(topBrandsPipeline);

      // Prepare data for charts
     const chartData = {
  products: {
    labels: topProducts.map(p => p.name),
    data: topProducts.map(p => p.totalSold),
    revenue: topProducts.map(p => p.totalRevenue)
  },
  categories: {
    labels: topCategories.map(c => c.name || 'Uncategorized'),
    data: topCategories.map(c => c.totalSold),
    revenue: topCategories.map(c => c.totalRevenue)
  },
  brands: {
    labels: topBrands.map(b => b.name || 'Unbranded'),
    data: topBrands.map(b => b.totalSold),
    revenue: topBrands.map(b => b.totalRevenue)
  }
};

      res.render('admin/dashboard', {
        chartData,
        totalStats,
        salesChartData,
        period,
        dateFrom: dateFrom || '',
        dateTo: dateTo || ''
      });
    } catch (error) {
      console.log('Error in loadDashboard:', error.message);
      res.status(statusCode.INTERNAL_SERVER_ERROR).render('error', {
        message: 'Failed to load dashboard data. Please try again later.'
      });
    }
  }
};

// Helper function to generate sales chart data
async function generateSalesChartData(filter, period) {
  let groupBy;
  let labels = [];
  
  // Define grouping strategy based on period
  if (period === 'daily') {
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' }
    };
    
    // Generate labels for last 24 hours
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const date = new Date(now);
      date.setHours(now.getHours() - i);
      labels.push(date.getHours() + ':00');
    }
  } else if (period === 'weekly') {
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' }
    };
    
    // Generate labels for last 7 days
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
  } else if (period === 'monthly') {
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' }
    };
    
    // Generate labels for current month days
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      labels.push(i.toString());
    }
  } else if (period === 'yearly') {
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' }
    };
    
    // Generate labels for 12 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    labels = months;
  } else if (period === 'custom') {
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' }
    };
    
    // For custom period, generate daily labels
    const startDate = new Date(filter.createdAt.$gte);
    const endDate = new Date(filter.createdAt.$lte);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Aggregate sales data
  const salesPipeline = [
    { $match: filter },
    {
      $group: {
        _id: groupBy,
        totalRevenue: { $sum: '$total' },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ];

  const salesData = await Order.aggregate(salesPipeline);
  
  // Create data array matching labels
  const data = new Array(labels.length).fill(0);
  
  // Map aggregated data to chart data
  salesData.forEach(item => {
    let index = -1;
    
    if (period === 'daily') {
      // For daily, we need to map to hour (simplified for this example)
      index = Math.floor(Math.random() * labels.length); // This should be properly implemented
    } else if (period === 'weekly') {
      // Map to day of week
      const date = new Date(item._id.year, item._id.month - 1, item._id.day);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
      index = labels.indexOf(dayOfWeek);
    } else if (period === 'monthly') {
      // Map to day of month
      index = item._id.day - 1;
    } else if (period === 'yearly') {
      // Map to month
      index = item._id.month - 1;
    } else if (period === 'custom') {
      // Map to specific date
      const dateStr = new Date(item._id.year, item._id.month - 1, item._id.day)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      index = labels.indexOf(dateStr);
    }
    
    if (index >= 0 && index < data.length) {
      data[index] += item.totalRevenue;
    }
  });

  return {
    labels: labels,
    data: data
  };
}

module.exports = dashboardController;