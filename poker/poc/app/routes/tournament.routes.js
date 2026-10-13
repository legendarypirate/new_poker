module.exports = app => {
  const tournament = require("../controllers/tournament.controller");
  
  var router = require("express").Router();
  
  // Get all tournaments
  router.get("/", tournament.findAll);
  
  // Get a single tournament by id
  router.get("/:id", tournament.findOne);
  
  app.use("/api/tournament", router);
};

