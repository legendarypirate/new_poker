module.exports = app => {
    const word = require("../controllers/word.controller.js");
  
    var router = require("express").Router();
  
    // Create a new ner tomyo
    router.post("/", word.create);
  
    // Retrieve all ner tomyo
    router.get("/", word.findAll);
  
    // Retrieve all published ner tomyo
    router.get("/published", word.findAllPublished);
  
    // Retrieve a single ner tomyo with id
    router.get("/:id", word.findOne);
  
    // Update a ner tomyo with id
    router.put("/:id", word.update);
  
    // Delete a ner tomyo with id
    router.delete("/:id", word.delete);
  
    // Delete all ner tomyo
    router.delete("/", word.deleteAll);
  
    app.use('/api/word', router);
  };
  