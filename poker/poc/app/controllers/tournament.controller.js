const db = require("../models");
const Tournament = db.tournaments;
const Op = db.Sequelize.Op;

// Get all tournaments (public)
exports.findAll = async (req, res) => {
  try {
    const { status } = req.query;
    const condition = {};
    
    if (status !== undefined) {
      condition.status = parseInt(status);
    }

    const tournaments = await Tournament.findAll({
      where: condition,
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({
      success: true,
      data: tournaments
    });
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching tournaments"
    });
  }
};

// Get single tournament (public)
exports.findOne = async (req, res) => {
  try {
    const id = req.params.id;
    const tournament = await Tournament.findByPk(id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found"
      });
    }

    res.json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error("Error fetching tournament:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching tournament"
    });
  }
};

