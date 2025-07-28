// // middleware/authMiddleware.js
// const isAuthenticated = (req, res, next) => {
//     if (req.isAuthenticated() || req.session.user) {
//       return next();
//     }
//     res.redirect('/user/userLogin');
//   };
  
//   const isNotAuthenticated = (req, res, next) => {
//     if (req.isAuthenticated() || req.session.user) {
//       return res.redirect('/user/userHome');
//     }
//     next();
//   };
  
//   module.exports = {
//     isAuthenticated,
//     isNotAuthenticated
//   };

const User = require("../models/userModel");

const isAuthenticated = async (req, res, next) => {
  try {
    console.log("Checking authentication...");
    if (req.session.user) {
      console.log("User session exists:", req.session.user);

      const user = await User.findById(req.session.user.userId);
      console.log("Fetched user from DB:", user);

     if (!user || user.isActive === false) {

        console.log("User is blocked. Destroying session.");
        req.session.destroy(err => {
          if (err) console.error("Session destroy error:", err);
          return res.redirect("/user/userLogin?blocked=true");
        });
        return;
      }

      return next();
    }

    console.log("No user session found.");
    res.redirect("/user/userLogin");
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.redirect("/user/userLogin");
  }
};

const isNotAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/user/userHome");
  }
  next();
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated
};
