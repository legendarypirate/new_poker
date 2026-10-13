module.exports = app => {
    const question = require("../controllers/question.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", question.create);
  
    // Retrieve all Tutorials
    router.get("/", question.findAll);
  

    // Retrieve all published Tutorials
    router.get("/published", question.findAllPublished);
  
    // Retrieve a single Tutorial with id
   
    // Update a Tutorial with id
    router.patch("/:id", question.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", question.delete);
  
    // Delete all Tutorials
    router.delete("/", question.deleteAll);
    router.get("/:id", question.findOne);

    app.use('/api/question', router);
  };
  