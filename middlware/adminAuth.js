// middleware/adminAuthMiddleware.js
const isAdminAuthenticated = (req, res, next) => {
    if (req.session.admin) {
      return next();
    }
    res.redirect('/adminLogin');
  };
  
  const isAdminNotAuthenticated = (req, res, next) => {
    if (req.session.admin) {
      return res.redirect('/loadDashboard');
    }
    next();
  };
  
  module.exports = {
    isAdminAuthenticated,
    isAdminNotAuthenticated
  };