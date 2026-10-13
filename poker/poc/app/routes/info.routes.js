module.exports = app => {
    const info = require("../controllers/info.controller.js");
  
    var router = require("express").Router();
  
    // Create a new Tutorial
    router.post("/", info.create);
  
    // Retrieve all Tutorials
    router.get("/infos", info.getInfosByCategory);

    // Retrieve all published Tutorials
    router.get("/published", info.findAllPublished);
    router.get("/title/:categoryName", info.title); // Use categoryName instead of categoryId
    router.get("/category/:cat_id", info.getInfosByCatId);

    // Retrieve a single Tutorial with id
    router.get("/:id", info.findOne);
  
    // Update a Tutorial with id
    router.patch("/:id", info.update);
  
    // Delete a Tutorial with id
    router.delete("/:id", info.delete);
  
    // Delete all Tutorials
    router.delete("/", info.deleteAll);
    router.get("/", info.findAll);



    app.use('/api/info', router);
  };
  