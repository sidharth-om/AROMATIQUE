const User=require("../../models/userModel")
const WalletTransaction=require("../../models/walletTransactionModel")
const Order=require("../../models/orderModel")
const Cart=require("../../models/cartModel")

const walletController={
  
    wallet:async (req,res) => {
        try {
            const userId=req.session.user.userId

            const currentPage=parseInt(req.query.page)||1
            const perPage=5
            const skip=(currentPage-1)*perPage


            const user=await User.findById(userId)
            const cart=await Cart.findOne({userId})

            const totalTransactions=await WalletTransaction.countDocuments({userId})

            const transaction= await WalletTransaction.find({userId}).sort({createdAt:-1}).skip(skip).limit(perPage)

            const totalPages=Math.ceil(totalTransactions/perPage)
            
            console.log("user::",user)

            // const balance=user.wallet.balance
            res.render("user/wallet",{transaction,user,cart,currentPage,totalPages,perPage,totalTransactions})
        } catch (error) {
            console.log(error.message)
        }
    }
}

module.exports=walletController