const Brand=require("../../models/brandModel")

const brandController={
    loadBrands:async (req,res) => {
        try {
            
            let perPage=5
            let page=parseInt(req.query.page)||1
            const search=req.query.search||"";
            const searchQuery=search.trim()

            const filter=searchQuery?{name:{$regex:searchQuery,$options:"i"}}:{}


            const totalBrands=await Brand.countDocuments(filter)
            const totalPages=Math.ceil(totalBrands/perPage)

            let brands=await Brand.find(filter).skip((page-1)*perPage).limit(perPage)
            console.log("hi brand:",brands)
            res.render("admin/brands",{brands,currentPage:page,totalPages,searchQuery})
        } catch (error) {
            console.log(error.message)
        }
    },
    addBrand:async (req,res) => {
        try {
            console.log("gffty");
            
            console.log("req.body",req.body)
            console.log("req.file",req.file)

            const {name}=req.body
            const image=req.file? `uploads/${req.file.filename}` : null; 

           
           

            if(!name||!name.trim()||!image||!image.trim()){
                return res.status(400).json({message:"name and image is required"})
            }

            const existingBrand=await Brand.findOne({name: { $regex: new RegExp(`^${name}$`, "i") }})

            if(existingBrand){
                return res.status(400).json({message:"brand is already existing"})
            }

            const newBrand=new Brand({name,image})
            await newBrand.save()


           return res.status(200).json({success:true,redirectUrl:"/admin/brands"})
        } catch (error) {
            console.log(error.message)
        }
    },
    editBrand:async (req,res) => {
        try {
            const {id}=req.params
            let { name, status } = req.body;
            let image=req.file
            console.log("haha:",id)
            console.log("hehe:",name,status,"img:",image)

            if(!name.trim()||!status.trim()){
                return res.status(400).json({message:"name and status required"})
            }

            const existingBrand=await Brand.findOne({name: { $regex: new RegExp(`^${name}$`, "i") },_id: { $ne: id}})

            if(existingBrand){
                return res.status(400).json({message:"brand is already existing"})
            }

            const updatedData={
                name,
                status
            }

            if(req.file){
                updatedData.image= `uploads/${req.file.filename}`; 
            }

            const updatedBrand=await Brand.findByIdAndUpdate(
                id,
                {$set:updatedData},
                {new:true}
            )

            return res.status(200).json({success:true,message:"Brand updated successfully"})
        } catch (error) {
            console.log(error.message)
        }
    }
}

module.exports=brandController