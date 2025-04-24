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
            const cart=await Cart.findOne({userId}).populate("items.productId")
            console.log("car::",cart)
            console.log("jjaa:",cart)
            res.render("user/cart",{cart,user})
        } catch (error) {
            console.log(error.message)
        }
    },
    addtoCart:async (req,res) => {
        try {
            const {id}=req.params
            const {volume,quantity=1}=req.body
            const userId=req.session.user.userId

            const product=await Product.findById(id)

            console.log("pprr::",product.categoryId)

            // if(!product.isActive){
            //   return res.status(400).json({message:"The product is blocked"})
            // }

            console.log("ll::",product.categoryId.status)
            // if(!product.categoryId.status){
            //   return res.status(400).json({message:"The category is blocked"})
            // }

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
          
         console.log("exx:",existingItem)

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
        }
    },
    deleteCart:async (req,res) => {
      try {
       
        // const productId=req.params
        const productId = new mongoose.Types.ObjectId(req.params.id);
        const userId=req.session.user.userId

        await Cart.updateOne(
          {userId},
          {$pull:{items:{productId}}}
        )
        
    res.json({ success: true, message: "Product removed from cart" });
      } catch (error) {
        console.log(error.message)
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

        item.quantity=quantity

        await cart.save()

        res.json({ success: true, message: 'Cart updated successfully' });

      } catch (error) {
        console.log(error.message)
      }
    }
}

module.exports=cartController