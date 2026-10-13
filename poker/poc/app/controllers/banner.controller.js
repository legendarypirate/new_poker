const db = require("../models");
const Banner = db.banners;
const Op = db.Sequelize.Op;

// Set up multer for file uploads
const multer = require('multer');
const path = require('path');

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'app/assets'); // Specify the destination folder
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Initialize multer upload
const upload = multer({ storage: storage }).single('image');

// Create and Save a new Banner
exports.create = (req, res) => {
  // Handle file upload
  upload(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      // A multer error occurred
      return res.status(500).json({ success: false, message: "Error uploading file." });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({ success: false, message: "Unknown error." });
    }
    
    // Validate request
    if (!req.body.link || !req.file) {
      return res.status(400).json({ success: false, message: "Link and image are required!" });
    }

    // Create a Banner
    const banner = {
      link: req.body.link,
      text: req.body.text,
      image: req.file.filename // Save the filename in the database
    };

    // Save Banner in the database
    Banner.create(banner)
      .then(data => {
        res.json({ success: true, data: data });
      })
      .catch(err => {
        res.status(500).json({ success: false, message: err.message || "Some error occurred while creating the Banner." });
      });
  });
};

// Retrieve all Banners from the database.
exports.findAll = async (req, res) => {
  const link = req.query.link;
  var condition = link ? { link: { [Op.like]: `%${link}%` } } : null;

  try {
    const data = await Banner.findAll({ where: condition });
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Some error occurred while retrieving banners." });
  }
};

// Find a single Banner with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  Banner.findByPk(id)
    .then(data => {
      if (data) {
        res.json({ success: true, data: data });
      } else {
        res.status(404).json({ success: false, message: `Cannot find Banner with id=${id}.` });
      }
    })
    .catch(err => {
      res.status(500).json({ success: false, message: "Error retrieving Banner with id=" + id });
    });
};

// Update a Banner by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;

  Banner.update(req.body, {
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.json({ success: true, message: "Banner was updated successfully." });
      } else {
        res.status(404).json({ success: false, message: `Cannot update Banner with id=${id}. Maybe Banner was not found or req.body is empty!` });
      }
    })
    .catch(err => {
      res.status(500).json({ success: false, message: "Error updating Banner with id=" + id });
    });
};

// Delete a Banner with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  Banner.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.json({ success: true, message: "Banner was deleted successfully!" });
      } else {
        res.status(404).json({ success: false, message: `Cannot delete Banner with id=${id}. Maybe Banner was not found!` });
      }
    })
    .catch(err => {
      res.status(500).json({ success: false, message: "Could not delete Banner with id=" + id });
    });
};

// Delete all Banners from the database.
exports.deleteAll = (req, res) => {
  Banner.destroy({
    where: {},
    truncate: false
  })
    .then(nums => {
      res.json({ success: true, message: `${nums} Banners were deleted successfully!` });
    })
    .catch(err => {
      res.status(500).json({ success: false, message: err.message || "Some error occurred while removing all banners." });
    });
};

// find all published Banner
exports.findAllPublished = (req, res) => {
  Banner.findAll({ where: { published: true } })
    .then(data => {
      res.json({ success: true, data: data });
    })
    .catch(err => {
      res.status(500).json({ success: false, message: err.message || "Some error occurred while retrieving banners." });
    });
};
