module.exports = app => {
    const product = require("../controllers/product.controller.js");
  
    var router = require("express").Router();
  
    // Create a new ner tomyo
    router.post("/", product.create);
  
    // Retrieve all ner tomyo
    router.get("/", product.findAll);
  
    // Retrieve all published ner tomyo
    router.get("/published", product.findAllPublished);
  
    // Retrieve a single ner tomyo with id
    router.get("/:id", product.findOne);
  
    // Update a ner tomyo with id
    router.put("/:id", product.update);
  
    // Delete a ner tomyo with id
    router.delete("/:id", product.delete);
  
    // Delete all ner tomyo
    router.delete("/", product.deleteAll);
  
    app.use('/api/product', router);
  };
  