const Product = require('../../models/productModel');
const mongoose = require('mongoose');

const inventoryController = {
  // Load Inventory List with Search & Pagination
  loadInventory: async (req, res) => {
    try {
      const search = req.query.search || '';
      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      // Build search query
      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { 'categoryId.name': { $regex: search, $options: 'i' } },
            { 'brand.name': { $regex: search, $options: 'i' } },
            { 'variants.volume': { $regex: search, $options: 'i' } }
          ]
        };
      }

      const totalProducts = await Product.countDocuments(query);
      const totalPages = Math.ceil(totalProducts / limit);

      const products = await Product.find(query)
        .populate('categoryId', 'name')
        .populate('brand', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Update low stock status dynamically
      const lowStockThreshold = 10;
      products.forEach(product => {
        if (product.variants && Array.isArray(product.variants)) {
          product.variants.forEach(variant => {
            variant.isLowStock = variant.quantity <= lowStockThreshold && variant.quantity > 0;
          });
        }
      });

      res.render('admin/inventory', {
        products,
        totalProducts,
        totalPages,
        currentPage: page,
        searchQuery: search,
        success: req.flash('success'),
        error: req.flash('error'),
        csrfToken: req.csrfToken()
      });
    } catch (err) {
      console.error('Error loading inventory:', err);
      res.render('admin/inventory', {
        products: [],
        totalProducts: 0,
        totalPages: 0,
        currentPage: 1,
        searchQuery: '',
        error: 'Something went wrong while loading inventory!',
        success: '',
        csrfToken: req.csrfToken()
      });
    }
  },

  // Handle Stock Update via AJAX
  updateStock: async (req, res) => {
    try {
      const { productId } = req.params;
      const { volume, quantity } = req.body;
      const lowStockThreshold = 10;

      console.log(`Stock update request received:`, {
        productId,
        volume,
        quantity,
        user: req.user ? req.user._id : 'No user',
        timestamp: new Date().toISOString()
      });

      // Validate authentication
      if (!req.user) {
        console.warn('Unauthorized stock update attempt');
        return res.status(401).json({ 
          success: false,
          message: 'Unauthorized: Please log in again' 
        });
      }

      // Validate input data
      if (!volume || quantity === undefined || quantity === null) {
        console.warn('Missing required fields:', { volume, quantity });
        return res.status(400).json({ 
          success: false,
          message: 'Volume and quantity are required' 
        });
      }

      const parsedQuantity = parseInt(quantity);
      if (isNaN(parsedQuantity) || parsedQuantity < 0) {
        console.warn('Invalid quantity value:', quantity);
        return res.status(400).json({ 
          success: false,
          message: 'Quantity must be a non-negative number' 
        });
      }

      // Validate productId format
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        console.warn(`Invalid productId format: ${productId}`);
        return res.status(400).json({ 
          success: false,
          message: 'Invalid product ID format. Must be a valid MongoDB ObjectId.' 
        });
      }

      // Find and update product
      const product = await Product.findById(productId);
      if (!product) {
        console.warn(`Product not found: ${productId}`);
        return res.status(404).json({ 
          success: false,
          message: 'Product not found' 
        });
      }

      // Find the specific variant
      const variant = product.variants.find(v => v.volume.trim().toLowerCase() === volume.trim().toLowerCase());
      if (!variant) {
        console.warn(`Variant not found: productId=${productId}, volume=${volume}`);
        return res.status(404).json({ 
          success: false,
          message: `Variant with volume "${volume}" not found` 
        });
      }

      // Store old quantity for logging10:40 AM IST on Saturday, June 28, 2025 logging
      const oldQuantity = variant.quantity;

      // Update variant
      variant.quantity = parsedQuantity;
      variant.isLowStock = parsedQuantity <= lowStockThreshold && parsedQuantity > 0;

      // Save the product
      try {
        await product.save();
      } catch (saveErr) {
        console.error('Failed to save product:', saveErr);
        return res.status(500).json({ 
          success: false,
          message: 'Failed to save stock update to database.' 
        });
      }

      console.log(`Stock updated successfully:`, {
        productId,
        volume,
        oldQuantity,
        newQuantity: parsedQuantity,
        isLowStock: variant.isLowStock,
        user: req.user._id,
        timestamp: new Date().toISOString()
      });

      // Send success response
      res.status(200).json({
        success: true,
        message: `Stock updated successfully. ${product.name} (${volume}) quantity changed from ${oldQuantity} to ${parsedQuantity}`,
        quantity: parsedQuantity,
        lowStockThreshold,
        isLowStock: variant.isLowStock,
        productName: product.name,
        volume: volume
      });

    } catch (err) {
      console.error(`Error updating stock:`, {
        productId: req.params.productId,
        volume: req.body.volume,
        quantity: req.body.quantity,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      // Send error response
      res.status(500).json({ 
        success: false,
        message: 'Server error occurred while updating stock. Please try again.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  },

  // Bulk stock update endpoint (optional enhancement)
  bulkUpdateStock: async (req, res) => {
    try {
      const { updates } = req.body; // Array of {productId, volume, quantity}
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required'
        });
      }

      const results = [];
      const lowStockThreshold = 10;

      for (const update of updates) {
        const { productId, volume, quantity } = update;
        
        try {
          const product = await Product.findById(productId);
          if (!product) {
            results.push({
              productId,
              volume,
              success: false,
              message: 'Product not found'
            });
            continue;
          }

          const variant = product.variants.find(v => v.volume.trim().toLowerCase() === volume.trim().toLowerCase());
          if (!variant) {
            results.push({
              productId,
              volume,
              success: false,
              message: 'Variant not found'
            });
            continue;
          }

          variant.quantity = parseInt(quantity);
          variant.isLowStock = variant.quantity <= lowStockThreshold && variant.quantity > 0;
          
          await product.save();
          
          results.push({
            productId,
            volume,
            success: true,
            message: 'Updated successfully',
            quantity: variant.quantity
          });
          
        } catch (error) {
          results.push({
            productId,
            volume,
            success: false,
            message: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Bulk update completed',
        results
      });

    } catch (err) {
      console.error('Error in bulk stock update:', err);
      res.status(500).json({
        success: false,
        message: 'Server error occurred during bulk update'
      });
    }
  }
};

module.exports = inventoryController;