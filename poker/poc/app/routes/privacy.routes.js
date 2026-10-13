module.exports = app => {
    const privacy = require("../controllers/privacy.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", privacy.create);
  
    // Retrieve all Tutorials
    router.get("/", privacy.findAll);
  
    // Retrieve all published Tutorials
    router.get("/published", privacy.findAllPublished);
  
    // Retrieve a single Tutorial with id
  
    // Update a Tutorial with id
    router.patch("/:id", privacy.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", privacy.delete);
  
    // Delete all Tutorials
    router.delete("/", privacy.deleteAll);
  
    router.get('/latest', privacy.findLatest);

    app.use('/api/privacy', router);
  };
  