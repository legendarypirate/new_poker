module.exports = app => {
    const banner = require("../controllers/banner.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", banner.create);
  
    // Retrieve all Tutorials
    router.get("/", banner.findAll);
  
    // Retrieve all published Tutorials
    router.get("/published", banner.findAllPublished);
  
    // Retrieve a single Tutorial with id
    router.get("/:id", banner.findOne);
  
    // Update a Tutorial with id
    router.put("/:id", banner.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", banner.delete);
  
    // Delete all Tutorials
    router.delete("/", banner.deleteAll);
  
    app.use('/api/banner', router);
  };
  