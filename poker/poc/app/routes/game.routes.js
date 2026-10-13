module.exports = app => {
    const game = require("../controllers/game.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", game.create);
  
    // Retrieve all Tutorials
    router.get("/", game.findAll);
  
    // Retrieve all published Tutorials
    router.get("/published", game.findAllPublished);
  
    // Retrieve a single Tutorial with id
    router.get("/:id", game.findOne);
  
    // Update a Tutorial with id
    router.patch("/:id", game.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", game.delete);
  
    // Delete all Tutorials
    router.delete("/", game.deleteAll);
  
    app.use('/api/game', router);
  };
  