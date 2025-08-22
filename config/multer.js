
// const multer = require("multer");
// const path = require("path");

// // Set storage options
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, "public/uploads"); // Ensure "uploads" folder exists
//     },
//     filename: function (req, file, cb) {
//         cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
//     }
// });

// // File filter (optional)
// const fileFilter = (req, file, cb) => {
//     console.log("File received:", file.originalname); // Debugging
//     cb(null, true);
// };

// // Multer upload instance
// const upload = multer({ storage: storage, fileFilter: fileFilter })

// module.exports = upload; // Export the multer instance






const multer = require("multer");
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
// const multerS3 = require('multer-s3');

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Set storage options for S3 using multer-s3 (v3 compatible)
const multerS3 = require('multer-s3');
const storage = multerS3({
  s3: s3Client,  // Pass v3 S3Client
  bucket: process.env.S3_BUCKET_NAME,
  acl: undefined,  // ACL is deprecated in v3; use bucket policy instead
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const extension = file.originalname.split('.').pop();
    cb(null, `categories/${Date.now()}.${extension}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  console.log("File received:", file.originalname);
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(file.originalname.toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpeg, jpg, png, gif) are allowed"));
  }
};

// Multer upload instance
const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;