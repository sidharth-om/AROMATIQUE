const Category = require("../../models/category")
const Product=require("../../models/productModel")
const Brand=require("../../models/brandModel")




const productController={
    loadProducts:async (req,res) => {
        try {

            let page=parseInt(req.query.page)||1
            let limit=5
            let skip=(page-1)*limit
            let search=req.query.search ? req.query.search.trim() : ""; 
            let searchQuery=search.trim()
            let query={}

            if(searchQuery){
               query={name:{$regex:searchQuery,$options:"i"}}
            }

            const totalProducts=await Product.countDocuments(query)
            const totalPages=Math.ceil(totalProducts/limit)

            const products=await Product.find(query).populate("categoryId","name").populate("brand","name").skip(skip).limit(limit).sort({createdAt:-1})

           

            res.render("admin/products",{products,currentPage:page,totalPages,searchQuery})
        } catch (error) {
            console.log(error.message)  
        }
    },
    addProduct:async (req,res) => {
        try {
         
            res.render("admin/addProduct")
        } catch (error) {
            console.log(error.message)
        }
    },

    // addProducts:async (req,res) => {
    //     try {   
    //         console.log("req body : add>>>",req.body)
    //         const { name, brand,category, description,volume } = req.body;

    //         const images = req.files.length>0 ? req.files.map(file => file.filename) : [];
    //         console.log("req.body :::",name,brand,category,description,volume,images)
           
    //         const variantPrice = Array.isArray(req.body.variantPrice) ? req.body.variantPrice[0] : req.body.variantPrice;
    //         const quantity = Array.isArray(req.body.quantity) ? req.body.quantity[0] : req.body.quantity;

    //         if(!name.trim()||!brand.trim()||!description.trim()||!category.trim()||!volume.trim()||!variantPrice.trim()||!quantity.trim()){
    //             return res.status(400).json({message:"please fill the fields"})
    //         }

    //         let price=Number(variantPrice)
    //         let quant=Number(quantity)
    //         let vol=Number(volume)
    //         if(price<0||quant<0||vol<0){
    //             return res.status(400).json({message:"variants should be positive number"})
    //         }

        
    //         const existingProduct=await Product.findOne({name: { $regex: new RegExp(`^${name}$`, "i") }})

    //         if(existingProduct){
    //             return res.status(400).json({message:"Product already existing"})
    //         }

    //         const newProduct = new Product({
    //             name,
    //             brand,
    //             categoryId: category,
    //             description,
    //             images,
    //             variants: [{
    //               volume,
    //               regularPrice: variantPrice,
    //               quantity
    //             }]
    //           });
    //         await newProduct.save()

    //         return res.status(200).json({message:"successfully added product",success:true})
    //     } catch (error) {
    //         console.log(error.message)
    //     }
    // },

    addProducts: async (req, res) => {
        try {
            console.log("req body : add>>>", req.body);
            const { name, brand, category, description } = req.body;
            const images = req.files.length > 0 ? req.files.map(file => file.filename) : [];
            
            if (!name.trim() || !brand.trim() || !description.trim() || !category.trim()) {
                return res.status(400).json({ message: "Please fill all the fields" });
            }
            
            // Count the number of variants
            const variantCount = parseInt(req.body.variantCount) || 1;
            
            // Prepare the variants array
            const variants = [];
            
            // Process each variant
            for (let i = 1; i <= variantCount; i++) {
                const volume = req.body[`volume_${i}`];
                const variantPrice = req.body[`variantPrice_${i}`];
                const quantity = req.body[`quantity_${i}`];
                
                if (!volume || !variantPrice || !quantity) {
                    continue; // Skip incomplete variants
                }
                
                const vol = Number(volume);
                const price = Number(variantPrice);
                const quant = Number(quantity);
                
                if (price < 0 || quant < 0 || vol < 0) {
                    return res.status(400).json({ message: "Variants should be positive numbers" });
                }
                
                variants.push({
                    volume: vol,
                    regularPrice: price,
                    quantity: quant
                });
            }
            
            if (variants.length === 0) {
                return res.status(400).json({ message: "At least one valid variant is required" });
            }
            
            const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
            
            if (existingProduct) {
                return res.status(400).json({ message: "Product already existing" });
            }
            
            const newProduct = new Product({
                name,
                brand,
                categoryId: category,
                description,
                images,
                variants: variants
            });
            
            await newProduct.save();
            
            return res.status(200).json({ message: "Successfully added product", success: true });
        } catch (error) {
            console.log(error.message);
            return res.status(500).json({ message: "Server error", success: false });
        }
    },
    getCatagories:async (req,res) => {
        try {
            const categories=await Category.find({},"name")
            res.json(categories)
        } catch (error) {
            console.log(error.message)
        }
    },
    getBrand:async (req,res) => {
        try {
            const brand=await Brand.find({},"name")
            res.json(brand)
        } catch (error) {
            console.log(error.message)
        }
    },
    loadEditProduct:async (req,res) => {
        try {
            const productId=req.params.id
            const product=await Product.findById(productId).populate("categoryId").populate("brand")
            res.render("admin/editProduct",{product})
        } catch (error) {
            console.log(error.message)
        }
    },
    
    editedProducts: async (req, res) => {
        try {
            const productId = req.body.productId;
            
            const {name, brand, category, offer, description} = req.body;
            
            // Parse variants
            // Handle multiple variants properly
            const volumes = Array.isArray(req.body.volume) ? req.body.volume : [req.body.volume];
            const prices = Array.isArray(req.body.regularPrice) ? req.body.regularPrice : [req.body.regularPrice];
            const quantities = Array.isArray(req.body.quantity) ? req.body.quantity : [req.body.quantity];
            
            // Build variants array
            const variants = [];
            for (let i = 0; i < volumes.length; i++) {
                variants.push({
                    volume: volumes[i],
                    regularPrice: prices[i],
                    quantity: quantities[i]
                });
            }
            
            // Validation
            if (!name.trim() || !brand.trim() || !category.trim() || !description.trim()) {
                return res.status(400).json({message: "Product update failed, please fill all required fields"});
            }
            
            // Validate all variants
            for (const variant of variants) {
                if (!variant.volume.trim() || !variant.regularPrice.trim() || !variant.quantity.trim()) {
                    return res.status(400).json({message: "All variant fields must be filled"});
                }
                
                const price = Number(variant.regularPrice);
                const quantity = Number(variant.quantity);
                const volume = Number(variant.volume);
                
                if (
                    isNaN(price) || price < 0 || price==0||
                    isNaN(quantity) || quantity < 0 || 
                    isNaN(volume) || volume < 0||volume==0
                ) {
                    return res.status(400).json({message: "All variant values (volume, price, quantity) must be positive numbers"});
                }
                
            }
            
            // Handle images
            const newImages = req.files ? req.files.map(file => file.filename) : [];
            const product = await Product.findById(productId);
            const updatedImages = [...product.images, ...newImages];
            
            // Check for duplicate product name
            const existingProduct = await Product.findOne({
                name: { $regex: new RegExp(`^${name}$`, "i") }, 
                _id: { $ne: productId }
            });
            
            if (existingProduct) {
                return res.status(400).json({message: "Product already exists"});
            }
            
            // Update the product
            await Product.findByIdAndUpdate(productId, {
                name: name,
                description: description,
                offer: offer || 0,
                brand: brand,
                categoryId: category,
                variants: variants,
                images: updatedImages
            });
            
            res.json({ success: true });
            
        } catch (error) {
            console.log("Update Error: ", error);
            res.status(500).json({ success: false, message: "Error updating product" });
        }
    },
    
    removeImage:async (req,res) => {
        try {
            console.log("humma",req.body)
            const { productId, index } = req.body;

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
            console.log("product",product);
            

    
            // Remove the image at the given index
            if (index >= 0 && index < product.images.length) {
                
                product.images.splice(index, 1);
                
                await product.save();
               
                return res.json({ success: true, message: "Image deleted successfully" });
            }
   
            res.status(400).json({ success: false, message: "Invalid image index" });
        } catch (error) {
            console.log(error.message)
        }
    },
    productStatus:async (req,res) => {
        try {
            console.log("hshshdh")
            const productId=req.params.id
            const product=await Product.findById(productId)

            if(!product) return res.json({success:false,message:"product not found"})

                product.isActive=!product.isActive
                await product.save()
                res.json({success:true,isActive:product.isActive})
        } catch (error) {
            console.log(error.message)
        }
    }
   
}



module.exports=productController



