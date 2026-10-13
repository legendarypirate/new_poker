module.exports = app => {
  const withdrawal = require("../controllers/withdrawal.controller");
  const { verifyToken } = require("../controllers/auth.controller");
  const admin = require("../controllers/admin.controller");
  
  var router = require("express").Router();

  // Middleware to check admin role
  const checkAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: "Access denied. Admin role required."
      });
    }
  };

  // Create a new withdrawal request (user)
  router.post("/", verifyToken, withdrawal.create);

  // Get all withdrawal requests (admin or user's own)
  router.get("/", verifyToken, withdrawal.findAll);

  // Get a single withdrawal request
  router.get("/:id", verifyToken, withdrawal.findOne);

  // Update withdrawal status (admin only)
  router.put("/:id", verifyToken, withdrawal.update);

  // Approve withdrawal (admin only)
  router.patch("/:id/approve", verifyToken, checkAdmin, admin.approveWithdrawal);

  // Reject withdrawal (admin only)
  router.patch("/:id/reject", verifyToken, checkAdmin, admin.rejectWithdrawal);

  // Delete a withdrawal request
  router.delete("/:id", verifyToken, withdrawal.delete);

  // Register routes with both plural and singular paths
  app.use("/api/withdrawals", router);
  app.use("/api/withdrawal", router);
};

