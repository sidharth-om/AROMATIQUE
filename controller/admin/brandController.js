// const Brand=require("../../models/brandModel")
// const statusCode=require("../../config/statusCode")
// const message=require("../../config/adminMessages")

// const brandController={
//     loadBrands:async (req,res) => {
//         try {
            
//             let perPage=5
//             let page=parseInt(req.query.page)||1
//             const search=req.query.search||"";
//             const searchQuery=search.trim()

//             const filter=searchQuery?{name:{$regex:searchQuery,$options:"i"}}:{}


//             const totalBrands=await Brand.countDocuments(filter)
//             const totalPages=Math.ceil(totalBrands/perPage)

//             let brands=await Brand.find(filter).skip((page-1)*perPage).limit(perPage)
//             console.log("hi brand:",brands)
//             res.render("admin/brands",{brands,currentPage:page,totalPages,searchQuery})
//         } catch (error) {
//             console.log(error.message)
//         }
//     },
//     addBrand:async (req,res) => {
//         try {
//             console.log("gffty");
            
//             console.log("req.body",req.body)
//             console.log("req.file",req.file)

//             const {name}=req.body
//             const image=req.file? `uploads/${req.file.filename}` : null; 

           
           

//             if(!name||!name.trim()||!image||!image.trim()){
//                 return res.status(statusCode.BAD_REQUEST).json({message:message.addBrandMissingFields})
//             }

//             const existingBrand=await Brand.findOne({name: { $regex: new RegExp(`^${name}$`, "i") }})

//             if(existingBrand){
//                 return res.status(statusCode.BAD_REQUEST).json({message:message.addBrandAlreadyExists})
//             }

//             const newBrand=new Brand({name,image})
//             await newBrand.save()


//            return res.status(statusCode.OK).json({success:true,redirectUrl:"/admin/brands"})
//         } catch (error) {
//             console.log(error.message)
//         }
//     },
//     editBrand:async (req,res) => {
//         try {
//             const {id}=req.params
//             let { name, status } = req.body;
//             let image=req.file
//             console.log("haha:",id)
//             console.log("hehe:",name,status,"img:",image)

//             if(!name.trim()||!status.trim()){
//                 return res.status(statusCode.BAD_REQUEST).json({message:message.editBrandMissingFields})
//             }

//             const existingBrand=await Brand.findOne({name: { $regex: new RegExp(`^${name}$`, "i") },_id: { $ne: id}})

//             if(existingBrand){
//                 return res.status(statusCode.BAD_REQUEST).json({message:message.editBrandAlreadyExists})
//             }

//             const updatedData={
//                 name,
//                 status
//             }

//             if(req.file){
//                 updatedData.image= `uploads/${req.file.filename}`; 
//             }

//             const updatedBrand=await Brand.findByIdAndUpdate(
//                 id,
//                 {$set:updatedData},
//                 {new:true}
//             )

//             return res.status(statusCode.OK).json({success:true,message:message.editBrandSuccess})
//         } catch (error) {
//             console.log(error.message)
//         }
//     }
// }

// module.exports=brandController










const Brand = require("../../models/brandModel");
const statusCode = require("../../config/statusCode");
const message = require("../../config/adminMessages");
const AWS = require("aws-sdk");

// Configure AWS S3 for signed URLs
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const getSignedUrl = (key) => {
  return s3.getSignedUrl("getObject", {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key.split("/").slice(-2).join("/"), // Extract key from full URL
    Expires: 3600, // URL valid for 1 hour
  });
};

const brandController = {
  loadBrands: async (req, res) => {
    try {
      let perPage = 5;
      let page = parseInt(req.query.page) || 1;
      const search = req.query.search || "";
      const searchQuery = search.trim();

      const filter = searchQuery ? { name: { $regex: searchQuery, $options: "i" } } : {};

      const totalBrands = await Brand.countDocuments(filter);
      const totalPages = Math.ceil(totalBrands / perPage);

      let brands = await Brand.find(filter)
        .skip((page - 1) * perPage)
        .limit(perPage);

      // Generate signed URLs for each brand image
      brands = brands.map((brand) => ({
        ...brand._doc,
        image: brand.image ? getSignedUrl(brand.image) : null,
      }));

      console.log("Brands with Signed URLs:", brands);

      res.render("admin/brands", { brands, currentPage: page, totalPages, searchQuery });
    } catch (error) {
      console.error(error.message);
      return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
    }
  },

  addBrand: async (req, res) => {
    try {
      console.log("Request Body:", req.body);
      console.log("Uploaded File:", req.file);

      const { name } = req.body;
      const image = req.file ? req.file.location : null; // Use S3 file location

      if (!name || !name.trim() || !image) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.addBrandMissingFields });
      }

      const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
      });

      if (existingBrand) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.addBrandAlreadyExists });
      }

      const newBrand = new Brand({ name, image });
      await newBrand.save();

      return res.status(statusCode.OK).json({ success: true, redirectUrl: "/brands" });
    } catch (error) {
      console.error(error.message);
      return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
    }
  },

  editBrand: async (req, res) => {
    try {
      const { id } = req.params;
      let { name, status } = req.body;
      const image = req.file ? req.file.location : null; // Use S3 file location

      console.log("Request Body:", req.body);
      console.log("Uploaded File:", req.file);

      if (!name.trim() || !status.trim()) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.editBrandMissingFields });
      }

      const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: id },
      });

      if (existingBrand) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.editBrandAlreadyExists });
      }

      const updatedData = {
        name,
        status,
      };

      if (image) {
        updatedData.image = image;
      }

      const updatedBrand = await Brand.findByIdAndUpdate(id, { $set: updatedData }, { new: true });

      if (!updatedBrand) {
        return res.status(statusCode.BAD_REQUEST).json({ message: "Brand update failed" });
      }

      return res.status(statusCode.OK).json({ success: true, message: message.editBrandSuccess });
    } catch (error) {
      console.error(error.message);
      return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
    }
  },
};

module.exports = brandController;