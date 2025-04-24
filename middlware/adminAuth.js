// middleware/adminAuthMiddleware.js
const isAdminAuthenticated = (req, res, next) => {
    if (req.session.admin) {
      return next();
    }
    res.redirect('/admin/adminLogin');
  };
  
  const isAdminNotAuthenticated = (req, res, next) => {
    if (req.session.admin) {
      return res.redirect('/admin/loadDashboard');
    }
    next();
  };
  
  module.exports = {
    isAdminAuthenticated,
    isAdminNotAuthenticated
  };