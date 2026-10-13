module.exports = app => {
    const age = require("../controllers/age.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", age.create);
  
    // Retrieve all Tutorials
    router.get("/", age.findAll);
  
    // Retrieve all published Tutorials
    router.get("/published", age.findAllPublished);
  
    // Retrieve a single Tutorial with id
    router.get("/:id", age.findOne);
  
    // Update a Tutorial with id
    router.patch("/:id", age.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", age.delete);
  
    // Delete all Tutorials
    router.delete("/", age.deleteAll);
  
    app.use('/api/age', router);
  };
  