
const User=require("../../models/userModel")
const Cart=require("../../models/cartModel")
const Wishlist=require("../../models/wishlist")
const Product=require("../../models/productModel")
const Category=require("../../models/category")
const statusCode=require("../../config/statusCode")
const message=require("../../config/userMessages")

const wishlistController={


  loadWishlist: async (req, res) => {
    try {
        const email = req.session.user.email
        const userId = req.session.user.userId
        const user = await User.findOne({email: email})
        const cart=await Cart.findOne({userId})
        
        const wishlist = await Wishlist.findOne({userId: userId})
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: 'name images variants offer description isActive categoryId brand',
                populate:{
                  path:'categoryId',
                  model:'Category',
                  select:'name offer status'
                }
            });

            if(wishlist && wishlist.products){
              wishlist.products=wishlist.products.map(item=>{
                const product=item.productId
                if(product && product.categoryId){
                  const productOffer=product.offer||0
                const categoryOffer=product.categoryId.offer||0
                const highestOffer=Math.max(productOffer,categoryOffer)

                item.highestOffer=highestOffer
                item.offerSource=productOffer>=categoryOffer ? 'product' : 'category'
                }
                return item
              })
            }
        
        console.log("Wishlist with products:", wishlist);
        res.render("user/wishlist", {user, cart, wishlist})
    } catch (error) {
        console.log(error.message)
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("Error loading wishlist");
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
                return res.status(statusCode.BAD_REQUEST).json({success:false, message: message.addtoWishlistAlreadyExists });
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
            
            return res.status(statusCode.OK).json({ success:true,message: message.addtoWishlistSuccess });
         

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
        return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.removeFromWishlistNotFound })
      }

      const productIndex=wishlist.products.findIndex(item=>
        item.productId.toString()===productId
      )

      if (productIndex === -1) {
        return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.removeFromWishlistProductNotFound })
      }

      wishlist.products.splice(productIndex,1)

      await wishlist.save()

      return res.status(statusCode.OK).json({ success: true, message: message.removeFromWishlistSuccess })
      } catch (error) {
        console.log(error.message)
      }
    }
}

module.exports=wishlistController