const Category = require("../../models/category");

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

      console.log("Filtered Categories:", categories);

      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.json({ categories, currentPage: page, totalPages, searchQuery });
      }

      res.render("admin/category", { categories, currentPage: page, totalPages, searchQuery });
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: "Server Error" });
    }
  },

  createCategory: async (req, res) => {
    try {
      console.log("Request Body:", req.body);
      console.log("Uploaded File:", req.file);

      const { name, description, offer } = req.body;
      const image = req.file ? `uploads/${req.file.filename}` : null;

      if (!image) {
        return res.status(400).json({ message: "Please select an image!" });
      }

      if (!name.trim() || !description.trim()) {
        return res.status(400).json({ message: "Name and description required" });
      }

      const offerPercentage = Number(offer) || 0;
      if (offerPercentage < 0 || offerPercentage > 100) {
        return res.status(400).json({ message: "Offer must be between 0 and 100%" });
      }

      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") }
      });

      if (existingCategory) {
        return res.status(400).json({ message: "Category already exists!" });
      }

      const newCategory = new Category({
        name,
        description,
        image,
        offer: offerPercentage
      });

      await newCategory.save();

      return res.status(200).json({ success: true, redirectUrl: "/admin/category" });
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  editCategory: async (req, res) => {
    const { id } = req.params;
    let { name, description, offer, status } = req.body;
    const image = req.file;

    console.log("offerofferoffer",offer)

    console.log("Request body:", req.body);
    console.log("Uploaded file:", req.file);

    if (!name.trim() || !description.trim() || !status.trim()) {
      return res.status(400).json({ message: "Please fill the required fields" });
    }

    offer = Number(offer) || 0;
    if (offer < 0 || offer > 100) {
      return res.status(400).json({ message: "Offer must be between 0 and 100%" });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: id }
    });

    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists!" });
    }

    console.log("🔹 Category ID:", id);

    try {
      const updatedData = {
        name,
        description,
        offer,
        status: status === "active",
      };

      if (req.file) {
        updatedData.image = `uploads/${req.file.filename}`;
      }

      console.log("🔹 Updating with Data:", updatedData);

      const updatedCategory = await Category.findByIdAndUpdate(
        id,
        { $set: updatedData },
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
};

module.exports = categoryController;