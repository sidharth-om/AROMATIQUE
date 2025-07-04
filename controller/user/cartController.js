const Cart=require("../../models/cartModel")
const Product=require("../../models/productModel")
const User=require("../../models/userModel")
const mongoose = require("mongoose");


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
            res.status(500).render("error", {message: "Failed to load cart"})
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
                return res.status(404).json({message: "Product not found"})
              }

              
              if(!product.isActive){
                return res.status(400).json({message: "The product is currently unavailable"})
              }

              
              if(!product.categoryId.status){
                return res.status(400).json({message: "Products from this category are currently unavailable"})
              }

             
              const variant = product.variants.find(v => v.volume === volume)
              if(!variant) {
                return res.status(400).json({message: "Selected variant is not available"})
              }

              if(variant.quantity < quantity) {
                return res.status(400).json({message: "Not enough stock available"})
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
                  return res.status(400).json({ message: "You can only add up to 6 units of this product." });
                }
                existingItem.quantity += quantity;
              } else {
                if (quantity > 6) {
                  return res.status(400).json({ message: "You can only add up to 6 units of this product." });
                }
                cart.items.push({
                  productId: id,
                  volume,
                  quantity
                });
              }
              
            await cart.save()
            
            return res.json({ success: true, message: "Product added to cart!" });
                
          } catch (error) {
              console.log(error.message)
              return res.status(500).json({ success: false, message: "Failed to add product to cart" });
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
          return res.status(404).json({ success: false, message: "Product not found in cart" });
        }
        
        res.json({ success: true, message: "Product removed from cart" });
      } catch (error) {
        console.log(error.message)
        res.status(500).json({ success: false, message: "Failed to remove product from cart" });
      }
    },
    
    updateCartQuantity:async (req,res) => {
      try {
        const {productId,quantity}=req.body
        const userId=req.session.user.userId
        
        if(quantity<1||quantity>6){
          return res.status(400).json({ success: false, message: 'Invalid quantity' });
        }

        const cart=await Cart.findOne({userId})

        if(!cart){
          return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const item=cart.items.find(item=>item.productId.toString()===productId)

        if(!item){
          return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
        
        // Check if there's enough stock before updating
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        const variant = product.variants.find(v => v.volume === item.volume);
        if (!variant || variant.quantity < quantity) {
          return res.status(400).json({ success: false, message: 'Not enough stock available' });
        }

        item.quantity=quantity

        await cart.save()

        res.json({ success: true, message: 'Cart updated successfully' });

      } catch (error) {
        console.log(error.message)
        res.status(500).json({ success: false, message: 'Failed to update cart' });
      }
    }
}

module.exports=cartController