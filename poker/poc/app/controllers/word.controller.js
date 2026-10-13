const db = require("../models");
const Word = db.words;
const Op = db.Sequelize.Op;

// Create and Save a new 
exports.create = (req, res) => {
  // Validate request
  if (!req.body.word) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
    return;
  }

  // Create a 
  const cat = {
    word: req.body.word,
    meaning:req.body.meaning
  };

  // Save  in the database
  Word.create(cat)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the ."
      });
    });
};

// Retrieve all  from the database.
exports.findAll = async (req, res) => {
  const word = req.query.word;
  var condition = word ? { word: { [Op.like]: `%${word}%` } } : null;

  try {
      console.log("ss");    
    const data = await Word.findAll({ where: condition });
    console.log(data);

    res.send({
      success: true,
      data: data
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: err.message || "Some error occurred while retrieving ."
    });
  }
};



// Find a single  with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  Word.findByPk(id)
    .then(data => {
      if (data) {
        res.send(data);
      } else {
        res.status(404).send({
          message: `Cannot find Word with id=${id}.`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error retrieving Word with id=" + id
      });
    });
};

// Update a Word by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;

  Word.update(req.body, {
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "Word was updated successfully."
        });
      } else {
        res.send({
          message: `Cannot update Word with id=${id}. Maybe Word was not found or req.body is empty!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating Word with id=" + id
      });
    });
};

// Delete a Word with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  Word.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "Word was deleted successfully!"
        });
      } else {
        res.send({
          message: `Cannot delete Word with id=${id}. Maybe Word was not found!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Could not delete Word with id=" + id
      });
    });
};

// Delete all Word from the database.
exports.deleteAll = (req, res) => {
    Word.destroy({
    where: {},
    truncate: false
  })
    .then(nums => {
      res.send({ message: `${nums} Word were deleted successfully!` });
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all Word."
      });
    });
};

// find all published Word
exports.findAllPublished = (req, res) => {
    Word.findAll({ where: { published: true } })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving Word."
      });
    });
};
