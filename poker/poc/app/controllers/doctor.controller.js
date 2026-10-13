const express = require('express');
const db = require("../models");
const Doctor = db.doctors;
const Op = db.Sequelize.Op;
const app = express();

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
app.use('/assets', express.static('app/assets')); // Serve files from 'app/assets' folder under the '/assets' URL

// Create and Save a new Banner
exports.create = (req, res) => {
  upload(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ success: false, message: "Error uploading file." });
    } else if (err) {
      return res.status(500).json({ success: false, message: "Unknown error." });
    }

    console.log(req.body);  // Log the request body
    console.log(req.file);   // Log the uploaded file object

    if (!req.body.name || !req.file) {
      return res.status(400).json({ success: false, message: "Link and image are required!" });
    }

    const doctor = {
      prof: req.body.prof,
      name: req.body.name,
      image: req.file.filename // Save the filename in the database
    };

    Doctor.create(doctor)
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
    const data = await Doctor.findAll({ where: condition });
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Some error occurred while retrieving banners." });
  }
};

// Find a single Banner with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  Doctor.findByPk(id)
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

  // Use multer to process the form data (including files)
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ success: false, message: "Error uploading file." });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message || "Unknown error." });
    }

    // Validate request (ensure at least name, prof, or image is present)
    if (!req.body.name && !req.body.prof && !req.file && !req.body.image) {
      return res.status(400).json({
        success: false,
        message: "Request body cannot be empty. At least name, prof, or image is required.",
      });
    }

    // Prepare the data for updating
    const updateData = {
      name: req.body.name || null,
      prof: req.body.prof || null,
      // Update only if new image is uploaded
      image: req.file ? req.file.filename : req.body.image || null, // Use the existing image if no new image is uploaded
    };

    // Update the doctor entry in the database
    Doctor.update(updateData, { where: { id: id } })
      .then((num) => {
        if (num == 1) {
          return Doctor.findByPk(id); // Fetch the updated entry
        } else {
          throw new Error("Doctor not found or no changes were made.");
        }
      })
      .then((updatedDoctor) => {
        res.json({
          success: true,
          message: "Doctor was updated successfully.",
          data: updatedDoctor,
        });
      })
      .catch((err) => {
        res.status(500).json({
          success: false,
          message: "Error updating doctor with id=" + id,
          error: err.message,
        });
      });
  });
};


// Delete a Banner with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  Doctor.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.json({ success: true, message: "Doctor was deleted successfully!" });
      } else {
        res.status(404).json({ success: false, message: `Cannot delete Doctor with id=${id}. Maybe Doctor was not found!` });
      }
    })
    .catch(err => {
      res.status(500).json({ success: false, message: "Could not delete Doctor with id=" + id });
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
