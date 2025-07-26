const Product = require("../../models/productModel")
const Category = require("../../models/category")
const Brand = require("../../models/brandModel")
const User = require("../../models/userModel")
const Cart = require("../../models/cartModel")

const userProductController = {
    productView: async (req, res) => {
        try {
            const productId = req.params.id
            console.log(productId);
            
            const products = await Product.findById(productId).populate("categoryId")
            console.log("this is produ", products)

            // Get product offer and category offer
            let productOffer = products.offer || 0
            let categoryOffer = products.categoryId.offer || 0
            
            // Determine the highest offer
            let highestOffer = Math.max(productOffer, categoryOffer)

            const category = products.categoryId._id
            console.log("Category : ", category);
            
            // Populate categoryId for related products to access category offers
            const relatedProduct = await Product.find({
                categoryId: category,
                _id: { $ne: productId }  // Exclude the current product
            }).populate("categoryId");  // Add this populate to get category offers
            
            console.log("related : ", relatedProduct);

            const email = req.session.user.email
            const user = await User.findOne({email: email})

            const userId = req.session.user.userId

            const cart = await Cart.findOne({userId})
            
            res.render("user/productView", {products, relatedProduct, user, cart, highestOffer})
        } catch (error) {
            console.log(error.message)
        }
    },

    loadShopping: async (req, res) => {
        try {
          let { brand, category, sort, search } = req.query;
          
          // Convert single values to arrays for consistent handling
          const selectedBrands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
          const selectedCategories = Array.isArray(category) ? category : (category ? [category] : []);
          
          const filter = {
            isActive: true // ✅ Only get active products
          };
      
          if (search) {
            filter.name = { $regex: search, $options: "i" };
          }
      
          // Brand filter - handle multiple brands
          if (selectedBrands.length > 0) {
            const brandDocs = await Brand.find({ 
              name: { $in: selectedBrands }, 
              status: "Active"
            });
            if (brandDocs.length > 0) {
              filter.brand = { $in: brandDocs.map(b => b._id) };
            }
          }
      
          // Category filter - handle multiple categories
          if (selectedCategories.length > 0) {
            const categoryDocs = await Category.find({ 
              name: { $in: selectedCategories } 
            });
            if (categoryDocs.length > 0) {
              filter.categoryId = { $in: categoryDocs.map(c => c._id) };
            }
          }
      
          // Sorting logic
          let sortQuery = {};
          if (sort === "priceLowToHigh") sortQuery = { "variants.0.regularPrice": 1 };
          if (sort === "priceHighToLow") sortQuery = { "variants.0.regularPrice": -1 };
          if (sort === "nameAToZ") sortQuery = { name: 1 };
          if (sort === "nameZToA") sortQuery = { name: -1 };
      
          const page = parseInt(req.query.page) || 1;
          const limit = 5;
          const skip = (page - 1) * limit;
      
          const totalProducts = await Product.countDocuments(filter);
      
          const products = await Product.find(filter)
            .populate("categoryId")
            .populate({
              path: "brand",
              match: { status: "Active" } // ✅ Only include products with active brands
            })
            .collation({ locale: 'en', strength: 2 })
            .sort(sortQuery)
            .skip(skip)
            .limit(limit);
      
          // ✅ Filter out products whose category is not active
          const filteredProducts = products.filter(
            (product) => product.brand && product.categoryId && product.categoryId.status === true
          );
          
          // Calculate the best offer for each product
          const productsWithOfferDetails = filteredProducts.map(product => {
            const productOffer = product.offer || 0;
            const categoryOffer = product.categoryId?.offer || 0;
            const highestOffer = Math.max(productOffer, categoryOffer);
            
            return {
              ...product._doc,
              highestOffer,
              offerSource: highestOffer === productOffer && productOffer > 0 ? 'product' : 
                          highestOffer === categoryOffer && categoryOffer > 0 ? 'category' : ''
            };
          });
      
          const brands = await Brand.find({ status: "Active" });
          const categories = await Category.find();

          const email = req.session.user.email
          const user = await User.findOne({email: email})

          const userId = req.session.user.userId

          const cart = await Cart.findOne({userId})
      
          res.render("user/shoppingPage", {
            brands,
            categories,
            products: productsWithOfferDetails,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            search: search || '',
            selectedBrands,
            selectedCategories,
            selectedSort: sort || '',
            user,
            cart
          });
        } catch (error) {
          console.log(error.message);
        }
      }
}

module.exports = userProductController