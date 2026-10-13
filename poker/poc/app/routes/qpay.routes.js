module.exports = app => {
    const qpay = require("../controllers/qpay.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/qpay", qpay.create);
  
    // Retrieve all Tutorials
    router.get("/", qpay.findAll);
  
    // Retrieve all published Tutorials
    router.get("/published", qpay.findAllPublished);
  
    // Retrieve a single Tutorial with id
    router.get("/:id", qpay.findOne);
  
    // Update a Tutorial with id
    router.patch("/:id", qpay.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", qpay.delete);
  
    // Delete all Tutorials
    router.delete("/", qpay.deleteAll);
  
    app.use('/api/qpay', router);
  };
  