const mongoose = require("mongoose");
require("dotenv").config({ path: '../.env' }); // Match the path

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to MongoDB");
  mongoose.connection.close();
}).catch(err => {
  console.error("Connection Error:", err);
});