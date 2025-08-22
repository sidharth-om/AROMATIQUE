// const Category = require("../../models/category");
// const Product = require("../../models/productModel");
// const Brand = require("../../models/brandModel");
// const { calculateBestPrice } = require("../../config/calculateBestPrice");
// const statusCode=require("../../config/statusCode")
// const message=require("../../config/adminMessages")

// const productController = {
//   loadProducts: async (req, res) => {
//     try {
//       let page = parseInt(req.query.page) || 1;
//       let limit = 10;
//       let skip = (page - 1) * limit;
//       let search = req.query.search ? req.query.search.trim() : "";
//       let categoryId = req.query.category;

//       let query = {};

//       if (search) {
//         query.name = { $regex: search, $options: "i" };
//       }

//       if (categoryId) {
//         query.categoryId = categoryId;
//       }

//       const totalProducts = await Product.countDocuments(query);
//       const totalPages = Math.ceil(totalProducts / limit);

//       const products = await Product.find(query)
//         .populate("categoryId")
//         .populate("brand")
//         .skip(skip)
//         .limit(limit)
//         .sort({ createdAt: -1 });

//       const productsWithOffers = products.map(product => {
//         const productData = product.toObject();

//         productData.variants = productData.variants.map(variant => {
//           const categoryOffer = productData.categoryId?.offer || 0;
//           const productOffer = productData.offer || 0;

//           const priceData = calculateBestPrice(
//             variant.regularPrice,
//             productOffer,
//             categoryOffer
//           );

//           return {
//             ...variant,
//             finalPrice: priceData.finalPrice,
//             appliedOffer: priceData.appliedOffer,
//             offerType: priceData.offerType,
//             savedAmount: priceData.savedAmount
//           };
//         });

//         return productData;
//       });

//       if (req.xhr || req.headers.accept.indexOf("json") > -1) {
//         return res.json({
//           products: productsWithOffers,
//           currentPage: page,
//           totalPages,
//           totalProducts
//         });
//       }

//       res.render("admin/products", {
//         products: productsWithOffers,
//         currentPage: page,
//         totalPages,
//         totalProducts,
//         searchQuery: search
//       });
//     } catch (error) {
//       console.log("Error fetching products:", error.message);
//       return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: "Server Error" });
//     }
//   },

//   addProduct: async (req, res) => {
//     try {
//       res.render("admin/addProduct");
//     } catch (error) {
//       console.log(error.message);
//     }
//   },

//   addProducts: async (req, res) => {
//     try {
//       console.log("req body : add>>>", req.body);
//       const { name, brand, category, description, offer } = req.body;
//       const images = req.files.length > 0 ? req.files.map(file => file.filename) : [];

//       if (!name.trim() || !brand.trim() || !description.trim() || !category.trim()) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsMissingFields });
//       }

//       const offerPercentage = Number(offer) || 0;
//       if (offerPercentage < 0 || offerPercentage > 100) {
//         return res.status(statusCode.BAD_REQUEST).json({ message:message.addProductsInvalidOffer });
//       }

//       const variantCount = parseInt(req.body.variantCount) || 1;
//       const variants = [];

//       for (let i = 1; i <= variantCount; i++) {
//         const volume = req.body[`volume_${i}`];
//         const variantPrice = req.body[`variantPrice_${i}`];
//         const quantity = req.body[`quantity_${i}`];

//         if (!volume || !variantPrice || !quantity) {
//           continue;
//         }

//         const vol = Number(volume);
//         const price = Number(variantPrice);
//         const quant = Number(quantity);

//         if (price < 0 || quant < 0 || vol < 0) {
//           return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsInvalidVariantValues });
//         }

//         variants.push({
//           volume: vol,
//           regularPrice: price,
//           quantity: quant
//         });
//       }

//       if (variants.length === 0) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: "At least one valid variant is required" });
//       }

//       const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });

//       if (existingProduct) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsAlreadyExists });
//       }

//       const newProduct = new Product({
//         name,
//         brand,
//         categoryId: category,
//         description,
//         offer: offerPercentage,
//         images,
//         variants
//       });

//       await newProduct.save();

//       return res.status(statusCode.OK).json({ message:message.addProductsSuccess, success: true });
//     } catch (error) {
//       console.log(error.message);
//       return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.addProductGeneralError, success: false });
//     }
//   },

//   getCatagories: async (req, res) => {
//     try {
//       const categories = await Category.find({}, "name");
//       res.json(categories);
//     } catch (error) {
//       console.log(error.message);
//     }
//   },

//   getBrand: async (req, res) => {
//     try {
//       const brand = await Brand.find({}, "name");
//       res.json(brand);
//     } catch (error) {
//       console.log(error.message);
//     }
//   },

//   loadEditProduct: async (req, res) => {
//     try {
//       const productId = req.params.id;
//       const product = await Product.findById(productId).populate("categoryId").populate("brand");
//       res.render("admin/editProduct", { product });
//     } catch (error) {
//       console.log(error.message);
//     }
//   },

//   editedProducts: async (req, res) => {
//     try {
//       const productId = req.body.productId;
//       const { name, brand, category, offer, description } = req.body;

//       const offerPercentage = Number(offer) || 0;
//       if (offerPercentage < 0 || offerPercentage > 100) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsInvalidOffer});
//       }

//       const volumes = Array.isArray(req.body.volume) ? req.body.volume : [req.body.volume];
//       const prices = Array.isArray(req.body.regularPrice) ? req.body.regularPrice : [req.body.regularPrice];
//       const quantities = Array.isArray(req.body.quantity) ? req.body.quantity : [req.body.quantity];

//       const variants = [];
//       for (let i = 0; i < volumes.length; i++) {
//         variants.push({
//           volume: volumes[i],
//           regularPrice: prices[i],
//           quantity: quantities[i]
//         });
//       }

//       if (!name.trim() || !brand.trim() || !category.trim() || !description.trim()) {
//         return res.status(statusCode.BAD_REQUEST).json({ message: "Product update failed, please fill all required fields" });
//       }

//       for (const variant of variants) {
//         if (!variant.volume.trim() || !variant.regularPrice.trim() || !variant.quantity.trim()) {
//           return res.status(statusCode.BAD_REQUEST).json({ message: message.editProductInvalidVariants });
//         }

//         const price = Number(variant.regularPrice);
//         const quantity = Number(variant.quantity);
//         const volume = Number(variant.volume);

//         if (
//           isNaN(price) || price <= 0 ||
//           isNaN(quantity) || quantity < 0 ||
//           isNaN(volume) || volume <= 0
//         ) {
//           return res.status(statusCode.BAD_REQUEST).json({ message:message.editProductInvalidVariantValues });
//         }
//       }

//       const newImages = req.files ? req.files.map(file => file.filename) : [];
//       const product = await Product.findById(productId);
//       const updatedImages = [...product.images, ...newImages];

//       const existingProduct = await Product.findOne({
//         name: { $regex: new RegExp(`^${name}$`, "i") },
//         _id: { $ne: productId }
//       });

//       if (existingProduct) {
//         return res.status(statusCode.BAD_REQUEST).json({ message:message.editProductAlreadyExists });
//       }

//       await Product.findByIdAndUpdate(productId, {
//         name,
//         description,
//         offer: offerPercentage,
//         brand,
//         categoryId: category,
//         variants,
//         images: updatedImages
//       });

//       res.json({ success: true });
//     } catch (error) {
//       console.log("Update Error: ", error);
//       res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.editProductGeneralError });
//     }
//   },

//   removeImage: async (req, res) => {
//     try {
//       console.log("humma", req.body);
//       const { productId, index } = req.body;

//       const product = await Product.findById(productId);
//       if (!product) {
//         return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.removeImageProductNotFound });
//       }

//       if (index >= 0 && index < product.images.length) {
//         product.images.splice(index, 1);
//         await product.save();
//         return res.json({ success: true, message: message.removeImageSuccess });
//       }

//       res.status(400).json({ success: false, message: message.removeImageInvalidIndex});
//     } catch (error) {
//       console.log(error.message);
//     }
//   },

//   productStatus: async (req, res) => {
//     try {
//       console.log("hshshdh");
//       const productId = req.params.id;
//       const product = await Product.findById(productId);

//       if (!product) return res.json({ success: false, message: message.productStatusNotFound });

//       product.isActive = !product.isActive;
//       await product.save();
//       res.json({ success: true, isActive: product.isActive });
//     } catch (error) {
//       console.log(error.message);
//     }
//   }
// };

// module.exports = productController;






const Category = require("../../models/category");
const Product = require("../../models/productModel");
const Brand = require("../../models/brandModel");
const { calculateBestPrice } = require("../../config/calculateBestPrice");
const statusCode = require("../../config/statusCode");
const message = require("../../config/adminMessages");
const AWS = require('aws-sdk');

// Configure AWS S3 for signed URLs
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const getSignedUrl = (key) => {
  if (!key || typeof key !== 'string') {
    return ''; // Return empty string or a placeholder URL if key is invalid
  }
  try {
    return s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key.split('/').slice(-2).join('/'), // Extract key from full URL
      Expires: 3600, // URL valid for 1 hour
    });
  } catch (error) {
    console.error("Error generating signed URL for key:", key, error.message);
    return ''; // Fallback for failed URL generation
  }
};

const productController = {
loadProducts: async (req, res) => {
  let page = parseInt(req.query.page) || 1; // Move outside try block
  try {
    let limit = 10;
    let skip = (page - 1) * limit;
    let search = req.query.search ? req.query.search.trim() : "";
    let categoryId = req.query.category;

    let query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    console.log("Query:", query);
    console.log("Page:", page, "Skip:", skip, "Limit:", limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Add validation for invalid page
    if (page > totalPages && totalPages > 0) {
      return res.redirect(`?page=${totalPages}&search=${encodeURIComponent(search)}`);
    }

    console.log("Total Products:", totalProducts, "Total Pages:", totalPages);

    const products = await Product.find(query)
      .populate("categoryId")
      .populate("brand")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    console.log("Products fetched:", products.length);

    const productsWithOffers = products.map(product => {
      const productData = product.toObject();

      // Ensure images is an array and handle invalid entries
      productData.images = Array.isArray(productData.images)
        ? productData.images
            .filter(image => image && typeof image === 'string')
            .map(image => getSignedUrl(image))
        : [];

      productData.variants = Array.isArray(productData.variants) ? productData.variants.map(variant => {
        const categoryOffer = productData.categoryId?.offer || 0;
        const productOffer = productData.offer || 0;

        const priceData = calculateBestPrice(
          variant.regularPrice,
          productOffer,
          categoryOffer
        );

        return {
          ...variant,
          finalPrice: priceData.finalPrice,
          appliedOffer: priceData.appliedOffer,
          offerType: priceData.offerType,
          savedAmount: priceData.savedAmount
        };
      }) : [];

      return productData;
    });

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        products: productsWithOffers,
        currentPage: page,
        totalPages,
        totalProducts
      });
    }

    res.render("admin/products", {
      products: productsWithOffers,
      currentPage: page,
      totalPages,
      totalProducts,
      searchQuery: search
    });
  } catch (error) {
    console.error("Error fetching products:", error.stack);
    console.error("Request Query:", req.query);
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: "Server Error" });
    } else {
      res.render("admin/products", {
        products: [],
        currentPage: page || 1, // Use the pre-declared page with fallback
        totalPages: 0,
        totalProducts: 0,
        searchQuery: req.query.search || "",
        error: error.message
      });
    }
  }
},  
  // ... (rest of the code remains unchanged)

  addProduct: async (req, res) => {
    try {
      res.render("admin/addProduct");
    } catch (error) {
      console.log(error.message);
    }
  },

  addProducts: async (req, res) => {
    try {
      console.log("req body : add>>>", req.body);
      const { name, brand, category, description, offer } = req.body;
      const images = req.files && Array.isArray(req.files) ? req.files.map(file => file.location) : []; // Handle null req.files

      if (!name.trim() || !brand.trim() || !description.trim() || !category.trim()) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsMissingFields });
      }

      const offerPercentage = Number(offer) || 0;
      if (offerPercentage < 0 || offerPercentage > 100) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsInvalidOffer });
      }

      const variantCount = parseInt(req.body.variantCount) || 1;
      const variants = [];

      for (let i = 1; i <= variantCount; i++) {
        const volume = req.body[`volume_${i}`];
        const variantPrice = req.body[`variantPrice_${i}`];
        const quantity = req.body[`quantity_${i}`];

        if (!volume || !variantPrice || !quantity) {
          continue;
        }

        const vol = Number(volume);
        const price = Number(variantPrice);
        const quant = Number(quantity);

        if (price < 0 || quant < 0 || vol < 0) {
          return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsInvalidVariantValues });
        }

        variants.push({
          volume: vol,
          regularPrice: price,
          quantity: quant
        });
      }

      if (variants.length === 0) {
        return res.status(statusCode.BAD_REQUEST).json({ message: "At least one valid variant is required" });
      }

      const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });

      if (existingProduct) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsAlreadyExists });
      }

      const newProduct = new Product({
        name,
        brand,
        categoryId: category,
        description,
        offer: offerPercentage,
        images, // Store S3 URLs or empty array
        variants
      });

      await newProduct.save();

      return res.status(statusCode.OK).json({ message: message.addProductsSuccess, success: true });
    } catch (error) {
      console.log(error.message);
      return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ message: message.addProductGeneralError, success: false });
    }
  },

  getCatagories: async (req, res) => {
    try {
      const categories = await Category.find({}, "name");
      res.json(categories);
    } catch (error) {
      console.log(error.message);
    }
  },

  getBrand: async (req, res) => {
    try {
      const brand = await Brand.find({}, "name");
      res.json(brand);
    } catch (error) {
      console.log(error.message);
    }
  },

  loadEditProduct: async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await Product.findById(productId).populate("categoryId").populate("brand");
      // Generate signed URLs for product images
      const productWithSignedUrls = {
        ...product._doc,
        images: Array.isArray(product.images) ? product.images.map(image => getSignedUrl(image)) : []
      };
      console.log("Signed URLs:", productWithSignedUrls.images);
      res.render("admin/editProduct", { product: productWithSignedUrls });
    } catch (error) {
      console.log(error.message);
    }
  },

  editedProducts: async (req, res) => {
    try {
      const productId = req.body.productId;
      const { name, brand, category, offer, description } = req.body;

      const offerPercentage = Number(offer) || 0;
      if (offerPercentage < 0 || offerPercentage > 100) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.addProductsInvalidOffer });
      }

      const volumes = Array.isArray(req.body.volume) ? req.body.volume : [req.body.volume];
      const prices = Array.isArray(req.body.regularPrice) ? req.body.regularPrice : [req.body.regularPrice];
      const quantities = Array.isArray(req.body.quantity) ? req.body.quantity : [req.body.quantity];

      const variants = [];
      for (let i = 0; i < volumes.length; i++) {
        variants.push({
          volume: volumes[i],
          regularPrice: prices[i],
          quantity: quantities[i]
        });
      }

      if (!name.trim() || !brand.trim() || !category.trim() || !description.trim()) {
        return res.status(statusCode.BAD_REQUEST).json({ message: "Product update failed, please fill all required fields" });
      }

      for (const variant of variants) {
        if (!variant.volume.trim() || !variant.regularPrice.trim() || !variant.quantity.trim()) {
          return res.status(statusCode.BAD_REQUEST).json({ message: message.editProductInvalidVariants });
        }

        const price = Number(variant.regularPrice);
        const quantity = Number(variant.quantity);
        const volume = Number(variant.volume);

        if (
          isNaN(price) || price <= 0 ||
          isNaN(quantity) || quantity < 0 ||
          isNaN(volume) || volume <= 0
        ) {
          return res.status(statusCode.BAD_REQUEST).json({ message: message.editProductInvalidVariantValues });
        }
      }

      const newImages = req.files && Array.isArray(req.files) ? req.files.map(file => file.location) : []; // Handle null req.files
      const product = await Product.findById(productId);
      const updatedImages = [...(Array.isArray(product.images) ? product.images : []), ...newImages];

      const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: productId }
      });

      if (existingProduct) {
        return res.status(statusCode.BAD_REQUEST).json({ message: message.editProductAlreadyExists });
      }

      await Product.findByIdAndUpdate(productId, {
        name,
        description,
        offer: offerPercentage,
        brand,
        categoryId: category,
        variants,
        images: updatedImages
      });

      res.json({ success: true });
    } catch (error) {
      console.log("Update Error: ", error);
      res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.editProductGeneralError });
    }
  },

  removeImage: async (req, res) => {
    try {
      console.log("humma", req.body);
      const { productId, index } = req.body;

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(statusCode.NOT_FOUND).json({ success: false, message: message.removeImageProductNotFound });
      }

      if (index >= 0 && Array.isArray(product.images) && index < product.images.length) {
        // Optionally delete the image from S3
        const imageKey = product.images[index].split('/').slice(-2).join('/');
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: imageKey
        }).promise();

        product.images.splice(index, 1);
        await product.save();
        return res.json({ success: true, message: message.removeImageSuccess });
      }

      res.status(400).json({ success: false, message: message.removeImageInvalidIndex });
    } catch (error) {
      console.log(error.message);
      res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.removeImageGeneralError });
    }
  },

  productStatus: async (req, res) => {
    try {
      console.log("hshshdh");
      const productId = req.params.id;
      const product = await Product.findById(productId);

      if (!product) return res.json({ success: false, message: message.productStatusNotFound });

      product.isActive = !product.isActive;
      await product.save();
      res.json({ success: true, isActive: product.isActive });
    } catch (error) {
      console.log(error.message);
      res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: message.productStatusGeneralError });
    }
  }
};

module.exports = productController;