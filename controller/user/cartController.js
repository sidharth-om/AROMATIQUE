const Cart=require("../../models/cartModel")
const Product=require("../../models/productModel")
const User=require("../../models/userModel")
const mongoose = require("mongoose");
const statusCode=require("../../config/statusCode")
const message=require("../../config/userMessages")


const cartController={

    loadCart:async (req,res) => {
        try {
          const email=req.session.user.email
            const userId=req.session.user.userId
             const user=await User.findOne({email:email})
            
            // Populate cart with product details and the category information for offer comparison
            const cart=await Cart.findOne({userId})
                .populate({
                    path: "items.productId",
                    populate: {
                        path: "categoryId", // Populate the category to get category offers
                        select: "name offer status"
                    }
                })
                
            console.log("cart loaded:", cart)
            res.render("user/cart", {cart, user})
        } catch (error) {
            console.log(error.message)
            res.status(statusCode.INTERNAL_SERVER_ERROR).render("error", {message: message.loadCartError})
        }
    },
    
    addtoCart:async (req,res) => {
          try {
              const {id}=req.params
              const {volume,quantity=1}=req.body
              const userId=req.session.user.userId

              const product=await Product.findById(id)
                .populate("categoryId") // Populate category to check status

              if(!product) {
                return res.status(statusCode.NOT_FOUND).json({message: message.addtoCartProductNotFound})
              }

              
              if(!product.isActive){
                return res.status(statusCode.BAD_REQUEST).json({message: message.addtoCartProductUnavailable})
              }

              
              if(!product.categoryId.status){
                return res.status(statusCode.BAD_REQUEST).json({message: message.addtoCartCategoryUnavailable})
              }

             
              const variant = product.variants.find(v => v.volume === volume)
              if(!variant) {
                return res.status(statusCode.BAD_REQUEST).json({message: message.addtoCartVariantNotAvailable})
              }

              if(variant.quantity < quantity) {
                return res.status(statusCode.BAD_REQUEST).json({message: message.addtoCartInsufficientStock})
              }

              let cart=await Cart.findOne({userId:userId})

              if(!cart){
                cart=new Cart({
                    userId,
                    items:[]
                })
              }

              const existingItem = cart.items.find(item =>
                item.productId.toString() === id.toString() && item.volume === volume
              );
              
            console.log("existing item:", existingItem)

            if (existingItem) {
                if (existingItem.quantity + quantity > 6) {
                  return res.status(statusCode.BAD_REQUEST).json({ message: message.addtoCartQuantityLimitExceeded});
                }
                existingItem.quantity += quantity;
              } else {
                if (quantity > 6) {
                  return res.status(statusCode.BAD_REQUEST).json({ message: message.addtoCartQuantityLimitExceeded});
                }
                cart.items.push({
                  productId: id,
                  volume,
                  quantity
                });
              }
              
            await cart.save()
            
            return res.json({ success: true, message: message.addtoCartSuccess });
                
          } catch (error) {
              console.log(error.message)
              return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.addtoCartGeneralError });
          }
    },
    
    deleteCart:async (req,res) => {
      try {
        const productId = new mongoose.Types.ObjectId(req.params.id);
        const userId=req.session.user.userId

        const result = await Cart.updateOne(
          {userId},
          {$pull:{items:{productId}}}
        )
        
        if (result.modifiedCount === 0) {
          return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.deleteCartProductNotFound });
        }
        
        res.json({ success: true, message: "Product removed from cart" });
      } catch (error) {
        console.log(error.message)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.deleteCartGeneralError });
      }
    },
    
    updateCartQuantity:async (req,res) => {
      try {
        const {productId,quantity}=req.body
        const userId=req.session.user.userId
        
        if(quantity<1||quantity>6){
          return res.status(statusCode.BAD_REQUEST).json({ success: false, message: message.updateCartQuantityInvalidQuantity });
        }

        const cart=await Cart.findOne({userId})

        if(!cart){
          return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.updateCartQuantityCartNotFound });
        }

        const item=cart.items.find(item=>item.productId.toString()===productId)

        if(!item){
          return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.updateCartQuantityProductNotFoundInCart });
        }
        
        // Check if there's enough stock before updating
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.updateCartQuantityProductNotFound });
        }
        
        const variant = product.variants.find(v => v.volume === item.volume);
        if (!variant || variant.quantity < quantity) {
          return res.status(statusCode.BAD_REQUEST).json({ success: false, message: message.updateCartQuantityInsufficientStock});
        }

        item.quantity=quantity

        await cart.save()

        res.json({ success: true, message: message.updateCartQuantitySuccess });

      } catch (error) {
        console.log(error.message)
        res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.updateCartQuantityGeneralError });
      }
    }
}

module.exports=cartController