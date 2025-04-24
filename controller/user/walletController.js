const User=require("../../models/userModel")
const WalletTransaction=require("../../models/walletTransactionModel")
const Order=require("../../models/orderModel")
const Cart=require("../../models/cartModel")

const walletController={
  
    wallet:async (req,res) => {
        try {
            const userId=req.session.user.userId

            const user=await User.findById(userId)

            const transaction= await WalletTransaction.find({userId})

             const cart=await Cart.findOne({userId})
            console.log("user::",user)

            // const balance=user.wallet.balance
            res.render("user/wallet",{transaction,user,cart})
        } catch (error) {
            console.log(error.message)
        }
    }
}

module.exports=walletController