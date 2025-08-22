// const Category = require("../../models/category");
// const statusCode = require("../../config/statusCode");
// const message = require("../../config/adminMessages");

// const categoryController = {
//   loadCategory: async (req, res) => {
//     try {
//       console.log("Query:", req.query);
//       let page = parseInt(req.query.page) || 1;
//       let limit = 5;
//       let skip = (page - 1) * limit;
//       let searchQuery = req.query.search || "";

//       let filter = searchQuery ? { name: new RegExp(searchQuery, "i") } : {};

//       console.log("Filter Applied:", filter);

//       let totalCategories = await Category.countDocuments(filter);
//       let totalPages = Math.ceil(totalCategories / limit);

//       let categories = await Category.find(filter)
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .exec();

//       console.log("Filtered Categories:", categories);

//       if (req.xhr || req.headers.accept.indexOf("json") > -1) {
//         return res.json({ categories, currentPage: page, totalPages, searchQuery });
//       }

//       res.render("admin/category", { categories, currentPage: page, totalPages, searchQuery });
//     } catch (error) {
//       console.error(error.message);
//       return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.loadCategoryGeneralError });
//     }
//   },

//   createCategory: async (req, res) => {
//     try {
//       console.log("Request Body:", req.body);
//       console.log("Uploaded File:", req.file);

//       const { name, description, offer } = req.body;
//       const image = req.file ? req.file.location : null; // Use S3 file location
//       console.log("Generated Image URL:", image); // Add this line

//       if (!image) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryMissingImage });
//       }

//       if (!name.trim() || !description.trim()) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryMissingFields });
//       }

//       const offerPercentage = Number(offer) || 0;
//       if (offerPercentage < 0 || offerPercentage > 100) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryInvalidOffer });
//       }

//       const existingCategory = await Category.findOne({
//         name: { $regex: new RegExp(`^${name}$`, "i") }
//       });

//       if (existingCategory) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryAlreadyExists });
//       }

//       const newCategory = new Category({
//         name,
//         description,
//         image, // Store S3 URL
//         offer: offerPercentage
//       });

//       await newCategory.save();

//       return res.status(statusCode.OK).json({ success: true, redirectUrl: "/admin/category" });
//     } catch (error) {
//       console.error(error.message);
//       return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
//     }
//   },

//   editCategory: async (req, res) => {
//     const { id } = req.params;
//     let { name, description, offer, status } = req.body;
//     const image = req.file ? req.file.location : null; // Use S3 file location

//     console.log("offerofferoffer", offer);
//     console.log("Request body:", req.body);
//     console.log("Uploaded file:", req.file);

//     if (!name.trim() || !description.trim() || !status.trim()) {
//       return res.status(statusCode.BAD_REQUEST).json({ message: message.editCategoryMissingFields });
//     }

//     offer = Number(offer) || 0;
//     if (offer < 0 || offer > 100) {
//       return res.status(statusCode.BAD_REQUEST).json({ message: message.editCategoryInvalidOffer });
//     }

//     const existingCategory = await Category.findOne({
//       name: { $regex: new RegExp(`^${name}$`, "i") },
//       _id: { $ne: id }
//     });

//     if (existingCategory) {
//       return res.status(statusCode.BAD_REQUEST).json({ message: message.editCategoryAlreadyExists });
//     }

//     console.log("🔹 Category ID:", id);

//     try {
//       const updatedData = {
//         name,
//         description,
//         offer,
//         status: status === "active",
//       };

//       if (image) {
//         updatedData.image = image; // Store S3 URL
//       }

//       console.log("🔹 Updating with Data:", updatedData);

//       const updatedCategory = await Category.findByIdAndUpdate(
//         id,
//         { $set: updatedData },
//         { new: true }
//       );

//       if (!updatedCategory) {
//         console.log("❌ Update Failed!");
//         return res.status(statusCode.BAD_REQUEST).json({ success: false, message: message.editCategoryUpdateFailed });
//       }

//       console.log("✅ Successfully Updated Category:", updatedCategory);
//       res.json({ success: true, message: message.editCategorySuccess, updatedCategory });
//     } catch (error) {
//       console.log("❌ Error Updating Category:", error.message);
//       res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.editCategoryGeneralError });
//     }
//   },
// };

// module.exports = categoryController;

const AWS = require('aws-sdk');
const Category = require("../../models/category");
const statusCode = require("../../config/statusCode");
const message = require("../../config/adminMessages");

// Configure AWS S3 (v2 for signed URLs, compatible with v3 uploads)
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const getSignedUrl = (key) => {
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key.split('/').slice(-2).join('/'), // Extract key from full URL
    Expires: 3600, // URL valid for 1 hour
  });
};

const categoryController = {
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

      let categories = await Category.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      console.log("Raw Categories:", categories);

      // Generate signed URLs for each category image
      categories = categories.map(category => ({
        ...category._doc,
        image: getSignedUrl(category.image)
      }));

      console.log("Categories with Signed URLs:", categories);

      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.json({ categories, currentPage: page, totalPages, searchQuery });
      }

      res.render("admin/category", { categories, currentPage: page, totalPages, searchQuery });
    } catch (error) {
      console.error(error.message);
      return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.loadCategoryGeneralError });
    }
  },

  createCategory: async (req, res) => {
    try {
      console.log("Request Body:", req.body);
      console.log("Uploaded File:", req.file);

      const { name, description, offer } = req.body;
      const image = req.file ? req.file.location : null;
      console.log("Generated Image URL:", image);

      if (!image) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryMissingImage });
      }

      if (!name.trim() || !description.trim()) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryMissingFields });
      }

      const offerPercentage = Number(offer) || 0;
      if (offerPercentage < 0 || offerPercentage > 100) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryInvalidOffer });
      }

      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") }
      });

      if (existingCategory) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.createCategoryAlreadyExists });
      }

      const newCategory = new Category({
        name,
        description,
        image,
        offer: offerPercentage
      });

      await newCategory.save();

      return res.status(statusCode.OK).json({ success: true, redirectUrl: "/admin/category" });
    } catch (error) {
      console.error(error.message);
      return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
    }
  },

  editCategory: async (req, res) => {
    const { id } = req.params;
    let { name, description, offer, status } = req.body;
    const image = req.file ? req.file.location : null;

    console.log("offerofferoffer", offer);
    console.log("Request body:", req.body);
    console.log("Uploaded file:", req.file);

    if (!name.trim() || !description.trim() || !status.trim()) {
      return res.status(statusCode.BAD_REQUEST).json({ message: message.editCategoryMissingFields });
    }

    offer = Number(offer) || 0;
    if (offer < 0 || offer > 100) {
      return res.status(statusCode.BAD_REQUEST).json({ message: message.editCategoryInvalidOffer });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: id }
    });

    if (existingCategory) {
      return res.status(statusCode.BAD_REQUEST).json({ message: message.editCategoryAlreadyExists });
    }

    console.log("🔹 Category ID:", id);

    try {
      const updatedData = {
        name,
        description,
        offer,
        status: status === "active",
      };

      if (image) {
        updatedData.image = image;
      }

      console.log("🔹 Updating with Data:", updatedData);

      const updatedCategory = await Category.findByIdAndUpdate(
        id,
        { $set: updatedData },
        { new: true }
      );

      if (!updatedCategory) {
        console.log("❌ Update Failed!");
        return res.status(statusCode.BAD_REQUEST).json({ success: false, message: message.editCategoryUpdateFailed });
      }

      console.log("✅ Successfully Updated Category:", updatedCategory);
      res.json({ success: true, message: message.editCategorySuccess, updatedCategory });
    } catch (error) {
      console.log("❌ Error Updating Category:", error.message);
      res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.editCategoryGeneralError });
    }
  },
};

module.exports = categoryController;