const db = require("../models");
const User = db.users;
const Op = db.Sequelize.Op;
const bcrypt = require('bcryptjs');
const saltRounds = 10; // Number of salt rounds for bcrypt

// Create and Save a new User
exports.create = async (req, res) => {
  // Validate request
  if (!req.body.username || !req.body.role || !req.body.password) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
    return;
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    // Create a User object
    const user = {
      username: req.body.username,
      role: req.body.role,
      password: hashedPassword
    };

    // Save User in the database
    const data = await User.create(user);
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the User."
    });
  }
};


exports.findAll = async (req, res) => {
  const username = req.query.username;
  let condition = { role: 'user' }; // Default condition: only users with role 'user'

  if (username) {
    condition.username = { [Op.like]: `%${username}%` }; // Add username filter if provided
  }

  try {
    const data = await User.findAll({ where: condition });

    res.send({
      success: true,
      data: data
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: err.message || "Some error occurred while retrieving users."
    });
  }
};

// Find a single User with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  User.findByPk(id)
    .then(data => {
      if (data) {
        res.send(data);
      } else {
        res.status(404).send({
          message: `Cannot find User with id=${id}.`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error retrieving User with id=" + id
      });
    });
};

// Update a User by the id in the request
exports.update = async (req, res) => {
  const id = req.params.id;

  // Prepare the data for updating
  const updateData = {
    end_date: req.body.end_date ? req.body.end_date : null,  // Ensure it's a valid date or null
    is_active: req.body.is_active !== undefined ? req.body.is_active : null // Ensure is_active is a valid value (0/1 or true/false)
  };

  try {
    // Check if the user exists before updating
    const existingUser = await User.findByPk(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: `User with id=${id} not found.`
      });
    }

    console.log("Existing user data:", existingUser);

    // Log the incoming and prepared data for debugging
    console.log("Incoming request data:", req.body);
    console.log("Prepared update data:", updateData);

    // Update the user directly using the where condition
    const [num] = await User.update(updateData, { where: { id: id } });

    console.log('Number of affected rows:', num);

    if (num === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes were made. The data might already be the same."
      });
    }

    // Fetch the updated user data
    const updatedUser = await User.findByPk(id);

    // Return the response with the updated user data
    res.json({
      success: true,
      message: "User was updated successfully.",
      data: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user:", err);  // Log full error for debugging

    // Return a structured error response
    res.status(500).json({
      success: false,
      message: `Error updating User with id=${id}`,
      error: err.message,
    });
  }
};


// Delete a User with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  User.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "User was deleted successfully!"
        });
      } else {
        res.send({
          message: `Cannot delete User with id=${id}. Maybe User was not found!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Could not delete User with id=" + id
      });
    });
};

// Delete all User from the database.
exports.deleteAll = (req, res) => {
  User.destroy({
    where: {},
    truncate: false
  })
    .then(nums => {
      res.send({ message: `${nums} User were deleted successfully!` });
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all User."
      });
    });
};

// find all published User
exports.findAllPublished = (req, res) => {
  User.findAll({ where: { published: true } })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving User."
      });
    });
};
