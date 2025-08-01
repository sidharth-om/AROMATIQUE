const Coupon = require("../../models/couponModel");

const adminCouponController = {
    // Load coupon management page
    loadCoupons: async (req, res) => {
        try {
            console.log('Query Parameters:', req.query)
            const page = parseInt(req.query.page) || 1;
            const limit = 5;
            const skip = (page - 1) * limit;
            
            // Get search query if exists
            const search = req.query.search || '';
            const searchQuery = {};

            if (search) {
                searchQuery.$or = [
                    { code: { $regex: search.toUpperCase(), $options: 'i' } }, // Convert search to uppercase for code
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const status = req.query.status;
            if (status && status !== 'all') {
                searchQuery.isActive = status === 'active';
            }

            // Log the query for debugging
            console.log('Search Query:', JSON.stringify(searchQuery));

            // Get coupons with pagination
            const coupons = await Coupon.find(searchQuery)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            
            const totalCoupons = await Coupon.countDocuments(searchQuery);
            const totalPages = Math.ceil(totalCoupons / limit);
            
            res.render("admin/coupons", {
                coupons,
                currentPage: page,
                totalPages,
                totalCoupons,
                search,
                status: status || 'all',
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            });
        } catch (error) {
            console.log("Error loading coupons:", error.message);
            res.status(500).render("admin/error", { 
                message: "Error loading coupons" 
            });
        }
    },
    
    // Load add coupon page
    loadAddCoupon: async (req, res) => {
        try {
            res.render("admin/addCoupon", {
                errors: [],
                formData: {}
            });
        } catch (error) {
            console.log("Error loading add coupon page:", error.message);
            res.redirect("/admin/coupons");
        }
    },
    
    // Create new coupon
   createCoupon: async (req, res) => {
    try {
        const {
            code,
            description,
            type,
            value,
            minOrder,
            maxDiscount,
            startDate,
            endDate,
            usageLimit
        } = req.body;
        
        // Validation errors array
        const errors = [];
        
        // Basic validations
        if (!code || code.trim().length === 0) {
            errors.push("Coupon code is required");
        } else if (code.trim().length < 3) {
            errors.push("Coupon code must be at least 3 characters long");
        } else if (!/^[A-Z0-9]+$/.test(code.trim().toUpperCase())) {
            errors.push("Coupon code can only contain letters and numbers");
        }
        
        if (!description || description.trim().length === 0) {
            errors.push("Description is required");
        } else if (description.trim().length < 10) {
            errors.push("Description must be at least 10 characters long");
        }
        
        if (!type || !['percentage', 'fixed', 'freeship'].includes(type)) {
            errors.push("Please select a valid coupon type");
        }
        
        if (!value || isNaN(value) || parseFloat(value) <= 0) {
            errors.push("Coupon value must be a positive number");
        } else {
            const numValue = parseFloat(value);
            if (type === 'percentage' && numValue > 100) {
                errors.push("Percentage discount cannot exceed 100%");
            }
            if (type === 'fixed' && numValue > 10000) {
                errors.push("Fixed discount cannot exceed ₹10,000");
            }
        }
        
        if (minOrder && (isNaN(minOrder) || parseFloat(minOrder) < 0)) {
            errors.push("Minimum order amount must be a valid positive number");
        }
        
        if (type === 'percentage' && maxDiscount) {
            if (isNaN(maxDiscount) || parseFloat(maxDiscount) <= 0) {
                errors.push("Maximum discount must be a positive number");
            }
        }
        
        // Date validations
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (!startDate) {
            errors.push("Start date is required");
        } else {
            const start = new Date(startDate);
            if (start < today) {
                errors.push("Start date cannot be in the past");
            }
        }
        
        if (!endDate) {
            errors.push("End date is required");
        } else if (startDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end <= start) {
                errors.push("End date must be after start date");
            }
            
            // Check if end date is too far in future (optional - max 1 year)
            const maxDate = new Date(start);
            maxDate.setFullYear(maxDate.getFullYear() + 1);
            if (end > maxDate) {
                errors.push("End date cannot be more than 1 year from start date");
            }
        }
        
        if (usageLimit && (isNaN(usageLimit) || parseInt(usageLimit) <= 0)) {
            errors.push("Usage limit must be a positive number");
        }
        
        // Check if coupon code already exists
        if (!errors.length) {
            const existingCoupon = await Coupon.findOne({ 
                code: code.trim().toUpperCase() 
            });
            if (existingCoupon) {
                errors.push("Coupon code already exists");
            }
        }
        
        // If validation errors exist, return JSON error response
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors.join(', '),
                errors: errors
            });
        }
        
        // Create new coupon
        const newCoupon = new Coupon({
            code: code.trim().toUpperCase(),
            description: description.trim(),
            type,
            value: parseFloat(value),
            minOrderAmount: minOrder ? parseFloat(minOrder) : 0,
            maxDiscount: (type === 'percentage' && maxDiscount) ? parseFloat(maxDiscount) : null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            usageLimit: usageLimit ? parseInt(usageLimit) : null,
            usedCount: 0,
            isActive: true
        });
        
        await newCoupon.save();
        
        // Return JSON success response
        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            redirectUrl: "/admin/coupon",
            coupon: newCoupon
        });
        
    } catch (error) {
        console.log("Error creating coupon:", error.message);
        res.status(500).json({
            success: false,
            message: "An error occurred while creating the coupon",
            error: error.message
        });
    }
},
    // Load edit coupon page
    loadEditCoupon: async (req, res) => {
        try {
            const couponId = req.params.id;
            const coupon = await Coupon.findById(couponId);
            
            if (!coupon) {
                return res.redirect("/admin/coupons?error=Coupon not found");
            }
            
            // Format dates for HTML input
            const formattedCoupon = {
                ...coupon.toObject(),
                startDate: coupon.startDate.toISOString().split('T')[0],
                endDate: coupon.endDate.toISOString().split('T')[0]
            };
            
            res.render("admin/editCoupon", {
                coupon: formattedCoupon,
                errors: [],
                formData: formattedCoupon
            });
        } catch (error) {
            console.log("Error loading edit coupon:", error.message);
            res.redirect("/admin/coupons?error=Error loading coupon");
        }
    },
    
    // Update coupon
    // Update coupon
updateCoupon: async (req, res) => {
    try {
        const couponId = req.params.id;
        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }
        
        const {
            code,
            description,
            type,
            value,
            minOrder,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
            isActive
        } = req.body;
        
        // Validation errors array
        const errors = [];
        
        // Basic validations
        if (!code || code.trim().length === 0) {
            errors.push("Coupon code is required");
        } else if (code.trim().length < 3) {
            errors.push("Coupon code must be at least 3 characters long");
        } else if (!/^[A-Z0-9]+$/.test(code.trim().toUpperCase())) {
            errors.push("Coupon code can only contain letters and numbers");
        }
        
        if (!description || description.trim().length === 0) {
            errors.push("Description is required");
        } else if (description.trim().length < 10) {
            errors.push("Description must be at least 10 characters long");
        }
        
        if (!type || !['percentage', 'fixed', 'freeship'].includes(type)) {
            errors.push("Please select a valid coupon type");
        }
        
        if (!value || isNaN(value) || parseFloat(value) <= 0) {
            errors.push("Coupon value must be a positive number");
        } else {
            const numValue = parseFloat(value);
            if (type === 'percentage' && numValue > 100) {
                errors.push("Percentage discount cannot exceed 100%");
            }
            if (type === 'fixed' && numValue > 10000) {
                errors.push("Fixed discount cannot exceed ₹10,000");
            }
        }
        
        if (minOrder && (isNaN(minOrder) || parseFloat(minOrder) < 0)) {
            errors.push("Minimum order amount must be a valid positive number");
        }
        
        if (type === 'percentage' && maxDiscount) {
            if (isNaN(maxDiscount) || parseFloat(maxDiscount) <= 0) {
                errors.push("Maximum discount must be a positive number");
            }
        }
        
        // Date validations
        if (!startDate) {
            errors.push("Start date is required");
        }
        
        if (!endDate) {
            errors.push("End date is required");
        } else if (startDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end <= start) {
                errors.push("End date must be after start date");
            }
        }
        
        if (usageLimit && (isNaN(usageLimit) || parseInt(usageLimit) <= 0)) {
            errors.push("Usage limit must be a positive number");
        }
        
        // Check if coupon code already exists (except current coupon)
        if (!errors.length && code.trim().toUpperCase() !== coupon.code) {
            const existingCoupon = await Coupon.findOne({ 
                code: code.trim().toUpperCase(),
                _id: { $ne: couponId }
            });
            if (existingCoupon) {
                errors.push("Coupon code already exists");
            }
        }
        
        // If validation errors exist, return JSON error response
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors.join(', '),
                errors: errors
            });
        }
        
        // Update coupon
        coupon.code = code.trim().toUpperCase();
        coupon.description = description.trim();
        coupon.type = type;
        coupon.value = parseFloat(value);
        coupon.minOrder = minOrder ? parseFloat(minOrder) : 0;
        coupon.maxDiscount = (type === 'percentage' && maxDiscount) ? parseFloat(maxDiscount) : null;
        coupon.startDate = new Date(startDate);
        coupon.endDate = new Date(endDate);
        coupon.usageLimit = usageLimit ? parseInt(usageLimit) : null;
        coupon.isActive = isActive === true || isActive === 'true';
        
        await coupon.save();
        
        // Return JSON success response
        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            coupon: coupon
        });
        
    } catch (error) {
        console.log("Error updating coupon:", error.message);
        res.status(500).json({
            success: false,
            message: "An error occurred while updating the coupon",
            error: error.message
        });
    }
},
    
    // Toggle coupon status
    toggleCouponStatus: async (req, res) => {
        try {
            const couponId = req.params.id;
            const coupon = await Coupon.findById(couponId);
            
            if (!coupon) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Coupon not found" 
                });
            }
            
            coupon.isActive = !coupon.isActive;
            await coupon.save();
            
            res.json({ 
                success: true, 
                message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
                isActive: coupon.isActive
            });
            
        } catch (error) {
            console.log("Error toggling coupon status:", error.message);
            res.status(500).json({ 
                success: false, 
                message: "An error occurred while updating coupon status" 
            });
        }
    },
    
    // Delete coupon
    deleteCoupon: async (req, res) => {
        try {
            const couponId = req.params.id;
            const coupon = await Coupon.findById(couponId);
            
            if (!coupon) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Coupon not found" 
                });
            }
            
            // Check if coupon has been used
            if (coupon.usedCount > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Cannot delete coupon that has been used by customers" 
                });
            }
            
            await Coupon.findByIdAndDelete(couponId);
            
            res.json({ 
                success: true, 
                message: "Coupon deleted successfully" 
            });
            
        } catch (error) {
            console.log("Error deleting coupon:", error.message);
            res.status(500).json({ 
                success: false, 
                message: "An error occurred while deleting coupon" 
            });
        }
    },
    
    // Get coupon details (for AJAX requests)
    getCouponDetails: async (req, res) => {
        try {
            const couponId = req.params.id;
            const coupon = await Coupon.findById(couponId);
            
            if (!coupon) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Coupon not found" 
                });
            }
            
            res.json({ 
                success: true, 
                coupon 
            });
            
        } catch (error) {
            console.log("Error getting coupon details:", error.message);
            res.status(500).json({ 
                success: false, 
                message: "An error occurred while fetching coupon details" 
            });
        }
    }
};

module.exports = adminCouponController;