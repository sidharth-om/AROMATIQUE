// middleware/authMiddleware.js
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() || req.session.user) {
      return next();
    }
    res.redirect('/user/userLogin');
  };
  
  const isNotAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() || req.session.user) {
      return res.redirect('/user/userHome');
    }
    next();
  };
  
  module.exports = {
    isAuthenticated,
    isNotAuthenticated
  };