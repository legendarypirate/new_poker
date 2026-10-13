const db = require("../models");
const Profile = db.profiles;
const Op = db.Sequelize.Op;

// Create and Save a new Categories
exports.create = (req, res) => {
  // Validate request
  if (!req.body.name) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
    return;
  }

  // Create a Categories
  const cat = {
    lastname: req.body.lastname,
    firstname: req.body.firstname,
    email: req.body.email,
    phone: req.body.phone,
    school: req.body.school,
    member: req.body.member,
    start_date: req.body.start_date,
    end_date: req.body.end_date
  };

  // Save Categories in the database
  Profile.create(cat)
  .then(data => {
    res.json({ success: true, data: data });
  })
  .catch(err => {
    res.status(500).json({ success: false, message: err.message || "Some error occurred while creating the Banner." });
  });
};

// Retrieve all Categories from the database.
exports.findAll = async (req, res) => {
  const lastname = req.query.lastname;
  var condition = lastname ? { lastname: { [Op.like]: `%${lastname}%` } } : null;

  try {
      console.log("ss");    
    const data = await Profile.findAll({ where: condition });
    console.log(data);

    res.send({
      success: true,
      data: data
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: err.message || "Some error occurred while retrieving Categories."
    });
  }
};



// Find a single Categories with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  category.findByPk(id)
    .then(data => {
      if (data) {
        res.send(data);
      } else {
        res.status(404).send({
          message: `Cannot find category with id=${id}.`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error retrieving category with id=" + id
      });
    });
};

// Update a Categories by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;
  console.log(req.body);
  const updateData = {
    name: req.body.name || null,// Convert age to JSON if present
  };

  category.update(updateData, {
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        return category.findByPk(id); // Fetch the updated entry
      } else {
        throw new Error(`Cannot update Banner with id=${id}. Maybe Banner was not found or req.body is empty!`);
      }
    })
    .then(updatedEntry => {
      res.json({
        success: true,
        message: "age was updated successfully.",
        data: updatedEntry
      });
    })
    .catch(err => {
      res.status(500).json({
        success: false,
        message: "Error updating Banner with id=" + id,
        error: err.message
      });
    });
};


// Delete a category with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  category.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.json({ success: true, message: "Category was deleted successfully!" });

      } else {
        res.send({
          message: `Cannot delete Categories with id=${id}. Maybe category was not found!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Could not delete category with id=" + id
      });
    });
};

// Delete all Tutorials from the database.
exports.deleteAll = (req, res) => {
  category.destroy({
    where: {},
    truncate: false
  })
    .then(nums => {
      res.send({ message: `${nums} category were deleted successfully!` });
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all category."
      });
    });
};

// find all published Categories
exports.findAllPublished = (req, res) => {
  category.findAll({ where: { published: true } })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving category."
      });
    });
};
