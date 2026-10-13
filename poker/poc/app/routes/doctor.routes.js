module.exports = app => {
    const doctor = require("../controllers/doctor.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", doctor.create);
  
    // Retrieve all Tutorials
    router.get("/", doctor.findAll);
  
    // Retrieve all published Tutorials
    router.get("/published", doctor.findAllPublished);
  
    // Retrieve a single Tutorial with id
    router.get("/:id", doctor.findOne);
  
    // Update a Tutorial with id
    router.patch("/:id", doctor.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", doctor.delete);
  
    // Delete all Tutorials
    router.delete("/", doctor.deleteAll);
  
    app.use('/api/doctor', router);
  };
  