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
          const filter = {
            isActive: true // ✅ Only get active products
          };
      
          if (search) {
            filter.name = { $regex: search, $options: "i" };
          }
      
          // Brand filter
          if (brand) {
            const brandDoc = await Brand.findOne({ name: brand });
            if (brandDoc) filter.brand = brandDoc._id;
          }
      
          // Category filter
          if (category) {
            const categoryDoc = await Category.findOne({ name: category });
            if (categoryDoc) filter.categoryId = categoryDoc._id;
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
            .populate("brand")
            .sort(sortQuery)
            .skip(skip)
            .limit(limit);
      
          // ✅ Filter out products whose category is not active
          const filteredProducts = products.filter(
            (product) => product.categoryId && product.categoryId.status === true
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
      
          const brands = await Brand.find();
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
            search,
            user,
            cart
          });
        } catch (error) {
          console.log(error.message);
        }
      }
}

module.exports = userProductController