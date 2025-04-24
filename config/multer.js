
const multer = require("multer");
const path = require("path");

// Set storage options
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads"); // Ensure "uploads" folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});

// File filter (optional)
const fileFilter = (req, file, cb) => {
    console.log("File received:", file.originalname); // Debugging
    cb(null, true);
};

// Multer upload instance
const upload = multer({ storage: storage, fileFilter: fileFilter })

module.exports = upload; // Export the multer instance
