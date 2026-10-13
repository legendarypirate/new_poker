module.exports = app => {
  const admin = require("../controllers/admin.controller");
  const { verifyToken } = require("../controllers/auth.controller");
  
  var router = require("express").Router();

  // Admin login
  router.post("/login", admin.login);

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

  // Dashboard
  router.get("/dashboard/stats", verifyToken, checkAdmin, admin.getDashboardStats);

  // Tournament routes
  router.get("/tournaments", verifyToken, checkAdmin, admin.getTournaments);
  router.get("/tournaments/:id", verifyToken, checkAdmin, admin.getTournament);
  router.post("/tournaments", verifyToken, checkAdmin, admin.createTournament);
  router.put("/tournaments/:id", verifyToken, checkAdmin, admin.updateTournament);
  router.delete("/tournaments/:id", verifyToken, checkAdmin, admin.deleteTournament);

  // User routes
  router.get("/users", verifyToken, checkAdmin, admin.getUsers);
  router.get("/users/:id", verifyToken, checkAdmin, admin.getUser);
  router.put("/users/:id/balance", verifyToken, checkAdmin, admin.updateUserBalance);

  // Withdrawal routes
  router.get("/withdrawals", verifyToken, checkAdmin, admin.getWithdrawals);
  router.post("/withdrawals/:id/approve", verifyToken, checkAdmin, admin.approveWithdrawal);
  router.post("/withdrawals/:id/reject", verifyToken, checkAdmin, admin.rejectWithdrawal);

  // Game routes
  router.post("/games/:id/end", verifyToken, checkAdmin, admin.endGame);

  // Platform charges routes
  router.get("/platform-charges", verifyToken, checkAdmin, admin.getPlatformCharges);

  app.use("/api/admin", router);
};

