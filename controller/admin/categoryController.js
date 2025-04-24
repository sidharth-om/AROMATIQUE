const Category=require("../../models/category")

const categoryController={
    // loadCategory:async (req,res) => {
    //         try {
    //             console.log("query  : ",req.query)
    //             let page=parseInt(req.query.page)||1
    //             let limit=5
    //             let skip=(page - 1) * limit
    //             let searchQuery=req.query.search || ""
    //             console.log("search query : ",searchQuery)
    
    //             let filter = searchQuery ? { name: new RegExp(searchQuery, "i") } : {};
    
    //             if(searchQuery){
    //                 filter.name={$regex:searchQuery,$options:"i"}
    //             }
    
    //             console.log("Search Query:", searchQuery);  // Debugging
    //             console.log("Filter Applied:", filter);    
    
    //             let totalCategories=await Category.countDocuments(filter)
    //             let totalPages=Math.ceil(totalCategories/limit)
    
    //             let categories=await Category.find(filter).skip(skip).limit(limit).exec()
    
              
    //                 console.log("filtered categories :",categories)
    //                 console.log("Image Path:", Category.image);
    //             res.render("admin/category",{categories,currentPage:page,totalPages,searchQuery })
                
    //         } catch (error) {
    //             console.log(error.message)
    //         }
    //     },
    loadCategory: async (req, res) => {
        try {
            console.log("Query:", req.query);
            let page = parseInt(req.query.page) || 1;
            let limit = 5;
            let skip = (page - 1) * limit;
            let searchQuery = req.query.search || "";

            let filter = searchQuery ? { name: new RegExp(searchQuery, "i") } : {};

            console.log("Filter Applied:", filter);

            let totalCategories = await Category.countDocuments(filter);
            let totalPages = Math.ceil(totalCategories / limit);

            let categories = await Category.find(filter).sort({createdAt:-1}).skip(skip).limit(limit).exec();

            console.log("Filtered Categories:", categories);

            // Check if the request expects JSON (AJAX call)
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({ categories, currentPage: page, totalPages, searchQuery });
            }

            // Render EJS page for normal requests
            res.render("admin/category", { categories, currentPage: page, totalPages, searchQuery });

        } catch (error) {
            console.error(error.message);
            return res.status(500).json({ message: "Server Error" });
        }
    },
        createCategory:async (req, res) => {
            try {
                console.log("Request Body:", req.body);
                console.log("Uploaded File:", req.file);
        
                const { name, description } = req.body;
                const image = req.file ? `uploads/${req.file.filename}` : null; // Save relative path
        
                if (!image) {
                    return res.status(400).json({ message: "please select a image!" });
                }
        
               if(!name.trim()||!description.trim()){
                return res.status(400).json({message:"name and description required"})
               }
        
                const existingCategory = await Category.findOne({name: { $regex: new RegExp(`^${name}$`, "i") }});
                if (existingCategory) {
                    return res.status(400).json({ message: "Category already exists!" });
                }
        
                const newCategory = new Category({ name, description, image });
                await newCategory.save();
        
                return res.status(200).json({ success: true, redirectUrl: "/admin/category" });
            } catch (error) {
                console.error(error.message);
                return res.status(500).json({ message: "Internal Server Error" });
            }
        },editCategory: async (req, res) => {
                const { id } = req.params;
                let { name, description, regularPrice, offerPrice, status } = req.body;
                const image = req.file 

                console.log("imager:",image)

                console.log("namm:",req.body)
                
                console.log("haha:",req.file)

                if(!name.trim()||!description.trim()||!regularPrice.trim()||!offerPrice.trim()||!status.trim()){
                    return res.status(400).json({message:"Please fill the fields"})
                }

                const existingCategory = await Category.findOne({name: { $regex: new RegExp(`^${name}$`, "i")},_id: { $ne: id}});
                if (existingCategory) {
                    return res.status(400).json({ message: "Category already exists!" });
                }
               

            
                // console.log("🔹 Received Data from Frontend:", req.body);
                console.log("🔹 Category ID:", id);
            
                try {
                    // Check if ID exists
                  
            
                    // Convert values to the correct data types
                    const updatedData = {
                        name,
                        description,
                        regularPrice: Number(regularPrice), // Convert to number
                        offerPrice: Number(offerPrice),
                        status: status === "active", // Convert "active" to true and anything else to false
                        
                    };

                  
                    if (req.file) {
                        updatedData.image = `uploads/${req.file.filename}`; // ✅ Store full path
                    }
                    
                    console.log("🔹 Updating with Data:", updatedData);
            
                    const updatedCategory = await Category.findByIdAndUpdate(
                        id, 
                        { $set: updatedData },  // ✅ Use $set to avoid overriding isListed
                        { new: true }
                    );
            
                    if (!updatedCategory) {
                        console.log("❌ Update Failed!");
                        return res.status(400).json({ success: false, message: "Update failed" });
                    }
            
                    console.log("✅ Successfully Updated Category:", updatedCategory);
                    res.json({ success: true, message: "Category updated successfully", updatedCategory });
                } catch (error) {
                    console.log("❌ Error Updating Category:", error.message);
                    res.status(500).json({ success: false, message: "Server error" });
                }
            },
          
       
}

module.exports=categoryController