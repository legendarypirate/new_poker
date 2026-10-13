module.exports = app => {
    const category = require("../controllers/category.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", category.create);
  
    // Retrieve all Tutorials
    router.get("/", category.findAll);
  
    router.get("/mobile_category", category.mobile_cat);

    // Retrieve all published Tutorials
    router.get("/published", category.findAllPublished);
  
    // Retrieve a single Tutorial with id
   
    // Update a Tutorial with id
    router.patch("/:id", category.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", category.delete);
  
    // Delete all Tutorials
    router.delete("/", category.deleteAll);
    router.get("/:id", category.findOne);

    app.use('/api/category', router);
  };
  