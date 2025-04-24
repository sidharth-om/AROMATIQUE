
const User=require("../../models/userModel")
const Cart=require("../../models/cartModel")
const Wishlist=require("../../models/wishlist")
const Product=require("../../models/productModel")

const wishlistController={


  loadWishlist: async (req, res) => {
    try {
        const email = req.session.user.email
        const userId = req.session.user.userId
        const user = await User.findOne({email: email})
        // const cart = await Cart.find({userId: userId})
         const cart=await Cart.findOne({userId})
        // Find wishlist and populate the product details
        const wishlist = await Wishlist.findOne({userId: userId})
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: 'name images variants offer description isActive categoryId brand'
            });
        
        console.log("Wishlist with products:", wishlist);
        res.render("user/wishlist", {user, cart, wishlist})
    } catch (error) {
        console.log(error.message)
        res.status(500).send("Error loading wishlist");
    }
},
    addtoWishlist:async (req,res) => {
        try {
            const {productId}=req.params
            const userId=req.session.user.userId
            console.log(productId)

            const product=await Product.findById(productId)
            console.log(product)


            let wishlist = await Wishlist.findOne({ userId });
    
            if (wishlist) {
              // Check if product is already in wishlist
              const productExists = wishlist.products.some(item => 
                item.productId.toString() === productId
              );
              
              if (productExists) {
                return res.status(400).json({success:false, message: 'Product already in wishlist' });
              }
              
              // Add product to existing wishlist
              wishlist.products.push({ productId });
              await wishlist.save();
            } else {
              // Create new wishlist for user
              wishlist = new Wishlist({
                userId,
                products: [{ productId }]
              });
              await wishlist.save();
            }
            
            return res.status(200).json({ success:true,message: 'Product added to wishlist' });
         

        } catch (error) {
            console.log(error.message)
        }
    },
    removeFromWishlist:async (req,res) => {
      try {
        console.log("njan ethi")
        const {productId} = req.params
       const userId=req.session.user.userId

       const wishlist=await Wishlist.findOne({userId})

       if (!wishlist) {
        return res.status(404).json({ success: false, message: 'Wishlist not found' })
      }

      const productIndex=wishlist.products.findIndex(item=>
        item.productId.toString()===productId
      )

      if (productIndex === -1) {
        return res.status(404).json({ success: false, message: 'Product not found in wishlist' })
      }

      wishlist.products.splice(productIndex,1)

      await wishlist.save()

      return res.status(200).json({ success: true, message: 'Product removed from wishlist' })
      } catch (error) {
        console.log(error.message)
      }
    }
}

module.exports=wishlistController