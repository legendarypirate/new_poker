module.exports = app => {
  const userStatistics = require("../controllers/user_statistics.controller.js");

  var router = require("express").Router();

  // Get statistics for a specific user
  router.get("/user/:userId", userStatistics.findByUserId);

  // Get statistics for a user filtered by game type and buy-in
  router.get("/user/:userId/filtered", userStatistics.findByUserGameBuyIn);

  // Get aggregated statistics for a user
  router.get("/user/:userId/aggregated", userStatistics.getAggregatedStats);

  app.use('/api/user-statistics', router);
};

