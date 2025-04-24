const User=require("../../models/userModel")



const customerController={
    loadCustomers:async (req,res) => {
       
        try {
            let search = req.query.search || ""; // Get search input
            let searchQuery=search.trim()
            let filter = {};
    
            if (searchQuery) {
                filter.$or = [
                    { fullname: { $regex: new RegExp(searchQuery, "i") } }, // Case-insensitive search
                    { email: { $regex: new RegExp(searchQuery, "i") } }
                ];
            }
    
            const perPage = 5; // Set how many users per page
            const page = parseInt(req.query.page) || 1; // Get current page from query
    
            const users = await User.find(filter).sort({createdAt:-1})
                .skip((page - 1) * perPage) // Skip users for pagination
                .limit(perPage); // Limit results per page
    
            const totalUsers = await User.countDocuments(filter);
            const totalPages = Math.ceil(totalUsers / perPage);
    
            res.render("admin/customers", {
                users,
                currentPage: page,
                totalPages,
                searchQuery
            });
    
        } catch (error) {
            console.error("Error fetching users:", error);
            res.status(500).send("Server error");
        }
    },
    customerStatus:async (req,res) => {
        try {

            console.log("hdhdhh")
            const userId=req.params.id
            const user=await User.findById(userId)

            if(!user) return res.json({success:false,message:"user not found"})

                user.isActive=!user.isActive
                await user.save()

                res.json({success:true,isActive:user.isActive})
            
        } catch (error) {
            console.log(error.message)
        }
    }



}


module.exports=customerController