const db = require("../models");
const UserStatistics = db.user_statistics;
const Op = db.Sequelize.Op;

// ✅ Get statistics for a specific user
exports.findByUserId = async (req, res) => {
  const userId = req.params.userId;
  try {
    const statistics = await UserStatistics.findAll({
      where: { user_id: userId },
      order: [['last_played_at', 'DESC']]
    });
    
    res.send({ 
      success: true, 
      data: statistics 
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    res.status(500).send({
      success: false,
      message: error.message || "Some error occurred while retrieving user statistics.",
    });
  }
};

// ✅ Get statistics for a specific user filtered by game type and buy-in
exports.findByUserGameBuyIn = async (req, res) => {
  const userId = req.params.userId;
  const { game_type, buy_in } = req.query;
  
  try {
    const whereClause = { user_id: userId };
    if (game_type) whereClause.game_type = game_type;
    if (buy_in) whereClause.buy_in = parseInt(buy_in);
    
    const statistics = await UserStatistics.findAll({
      where: whereClause,
      order: [['last_played_at', 'DESC']]
    });
    
    res.send({ 
      success: true, 
      data: statistics 
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    res.status(500).send({
      success: false,
      message: error.message || "Some error occurred while retrieving user statistics.",
    });
  }
};

// ✅ Get aggregated statistics for a user (total games played, won, etc.)
exports.getAggregatedStats = async (req, res) => {
  const userId = req.params.userId;
  try {
    const statistics = await UserStatistics.findAll({
      where: { user_id: userId }
    });
    
    const aggregated = {
      total_games_played: 0,
      total_games_won: 0,
      by_game_type: {},
      by_buy_in: {}
    };
    
    statistics.forEach(stat => {
      aggregated.total_games_played += stat.games_played || 0;
      aggregated.total_games_won += stat.games_won || 0;
      
      // Group by game type
      if (!aggregated.by_game_type[stat.game_type]) {
        aggregated.by_game_type[stat.game_type] = {
          games_played: 0,
          games_won: 0
        };
      }
      aggregated.by_game_type[stat.game_type].games_played += stat.games_played || 0;
      aggregated.by_game_type[stat.game_type].games_won += stat.games_won || 0;
      
      // Group by buy-in
      if (stat.buy_in) {
        if (!aggregated.by_buy_in[stat.buy_in]) {
          aggregated.by_buy_in[stat.buy_in] = {
            games_played: 0,
            games_won: 0
          };
        }
        aggregated.by_buy_in[stat.buy_in].games_played += stat.games_played || 0;
        aggregated.by_buy_in[stat.buy_in].games_won += stat.games_won || 0;
      }
    });
    
    res.send({ 
      success: true, 
      data: aggregated 
    });
  } catch (error) {
    console.error("Error fetching aggregated statistics:", error);
    res.status(500).send({
      success: false,
      message: error.message || "Some error occurred while retrieving aggregated statistics.",
    });
  }
};

