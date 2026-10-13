const db = require("../models");
const Info = db.infos;
const Op = db.Sequelize.Op;
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Category = db.Categories;
const Doctor = db.doctors;

// Ensure directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir("app/assets");
ensureDir("app/assets/audios");

// Storage settings for image and audio files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, "app/assets"); // Image storage
    } else if (file.mimetype === "audio/mpeg") {
      cb(null, "app/assets/audios"); // MP3 storage
    } else {
      return cb(new Error("Invalid file type!"));
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  },
});

// Initialize multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: function (req, file, cb) {
    console.log("Uploading file:", file.originalname, "Type:", file.mimetype);

    if (file.mimetype.startsWith("image/") || file.mimetype === "audio/mpeg") {
      cb(null, true);
    } else {
      console.error("Invalid file type:", file.mimetype);
      cb(new Error("Only image and MP3 files are allowed!"), false);
    }
  }
}).fields([
  { name: "image", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

// Create and Save a new Info entry
exports.create = (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ success: false, message: "Error uploading file." });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message || "Unknown error." });
    }

    // Validate request
    if (!req.body.title || !req.files.image) {
      return res.status(400).json({ success: false, message: "Title and image are required!" });
    }

    // Create an Info entry
    const info = {
      title: req.body.title,
      doctor: req.body.doctor,
      cat_id: req.body.cat_id,
      gender: req.body.gender,
      category: req.body.category,
      age: req.body.age,
      description: req.body.description,
      image: req.files.image ? req.files.image[0].filename : null, // Store image filename
      audio: req.files.audio ? req.files.audio[0].filename : null, // Store audio filename
    };

    // Save Info in the database
    Info.create(info)
      .then((data) => res.json({ success: true, data: data }))
      .catch((err) => res.status(500).json({ success: false, message: err.message || "Some error occurred while creating the entry." }));
  });
};

// Retrieve all Infos from the database

exports.findAll = async (req, res) => {
  const title = req.query.title;
  let condition = { isactive: '1' }; // Default condition

  if (title) {
    condition.title = { [Op.like]: `%${title}%` }; // Add title condition if provided
  }

  try {
    const data = await Info.findAll({
      where: condition,
      order: [['createdAt', 'DESC']], // Order by createdAt column in descending order
    });

    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Some error occurred while retrieving data."
    });
  }
};

exports.title = async (req, res) => {
  const categoryName = req.params.categoryName; // Get categoryName from route parameter
  const title = req.query.title; // Optionally filter by title
  let condition = { 
    isactive: 1, 
    category: categoryName  // Filter by category name
  };

  if (title) {
    condition.title = { [Op.like]: `%${title}%` }; // Add title condition if provided
  }

  try {
    const data = await Info.findAll({ where: condition });
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Some error occurred while retrieving data." });
  }
};


// Find a single Info entry by ID
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Fetching info with ID: ${id}`);

    const info = await Info.findByPk(id, {
      include: {
        model: Doctor,
        as: "doctorInfo", // Ensure alias matches your association in `index.js`
        attributes: ["id", "name", "image", "prof"], // Ensure "profession" is correct
      },
    });

    if (!info) {
      console.log(`Info with ID ${id} not found`);
      return res.status(404).json({ message: "Info not found" });
    }

    console.log("Fetched Info:", JSON.stringify(info, null, 2));
    res.json(info);
  } catch (error) {
    console.error("Error fetching info:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.getInfosByCategory = async (req, res) => {
  try {
    const categories = await Category.findAll({
      attributes: ["id", "name"],
      include: [
        {
          model: Info,
          as: "infos", // Alias used in the association
          attributes: ["id", "title", "richtext", "image","createdAt"],
          limit: 3, // Limit the number of Info items
          order: [["createdAt", "DESC"]], // Order by createdAt in descending order
        },
      ],
      order: [["id", "ASC"]], // Order categories by id
    });

    console.log("Categories and infos:", categories);

    const response = categories.map(category => ({
      category: category.name,
      category_id: category.id,
      infos: category.infos.map(info => ({
        id: info.id,
        title: info.title,
        image: info.image,
        richtext: info.richtext,
        createdAt: info.createdAt,
      })),
    }));

    res.json(response);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error retrieving data", error });
  }
};


exports.getInfosByCatId = async (req, res) => {
  try {
    const cat_id = req.params.cat_id;
    const infos = await Info.findAll({ where: { cat_id } });

    if (infos.length === 0) {
      return res.status(404).json({ message: "No infos found for this category" });
    }

    res.json(infos);
  } catch (error) {
    console.error("Error fetching infos by category:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// Update an Info entry by ID
exports.update = (req, res) => {
  const id = req.params.id;

  // Use multer to process the form data (including files)
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ success: false, message: "Error uploading file." });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message || "Unknown error." });
    }

    // Validate request (ensure at least title or image is present)
    if (Object.keys(req.body).length === 0 && !req.files.image && !req.body.title) {
      return res.status(400).json({
        success: false,
        message: "Request body cannot be empty and image/title is required.",
      });
    }

    // Fetch the current entry from the database to retain previous image/audio if not provided
    Info.findByPk(id)
      .then((existingEntry) => {
        if (!existingEntry) {
          return res.status(404).json({
            success: false,
            message: "Entry not found.",
          });
        }

        // Prepare the data for updating the entry
        const updateData = {
          title: req.body.title || existingEntry.title,
          doctor: req.body.doctor || existingEntry.doctor,
          gender: req.body.gender || existingEntry.gender,
          category: req.body.category || existingEntry.category,
          age: req.body.age || existingEntry.age,
          isactive: req.body.isactive || existingEntry.isactive,
          richtext: req.body.richtext || existingEntry.richtext,
          image: req.files.image ? req.files.image[0].filename : existingEntry.image, // Keep previous image if not provided
          audio: req.files.audio ? req.files.audio[0].filename : existingEntry.audio, // Keep previous audio if not provided
        };

        // Update the entry in the database
        return Info.update(updateData, { where: { id: id } });
      })
      .then((num) => {
        if (num == 1) {
          // Successfully updated
          return Info.findByPk(id); // Fetch the updated entry
        } else {
          throw new Error("No changes were made or entry not found.");
        }
      })
      .then((updatedEntry) => {
        res.json({
          success: true,
          message: "Entry was updated successfully.",
          data: updatedEntry,
        });
      })
      .catch((err) => {
        res.status(500).json({
          success: false,
          message: "Error updating entry with id=" + id,
          error: err.message,
        });
      });
  });
};

// Delete an Info entry by ID
exports.delete = (req, res) => {
  const id = req.params.id;

  Info.destroy({ where: { id: id } })
    .then((num) => {
      if (num == 1) {
        res.json({ success: true, message: "Entry was deleted successfully!" });
      } else {
        res.status(404).json({ success: false, message: `Cannot delete entry with id=${id}. Maybe it was not found!` });
      }
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: "Could not delete entry with id=" + id });
    });
};

// Delete all Info entries from the database
exports.deleteAll = (req, res) => {
  Info.destroy({ where: {}, truncate: false })
    .then((nums) => {
      res.json({ success: true, message: `${nums} entries were deleted successfully!` });
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: err.message || "Some error occurred while removing all entries." });
    });
};

// Find all published entries
exports.findAllPublished = (req, res) => {
  Info.findAll({ where: { published: true } })
    .then((data) => {
      res.json({ success: true, data: data });
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: err.message || "Some error occurred while retrieving data." });
    });
};
