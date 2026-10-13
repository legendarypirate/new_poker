const db = require("../models");
const Game = db.games;
const Op = db.Sequelize.Op;

// ✅ Create a new Game
exports.create = async (req, res) => {
  try {
    const {
      room_id,
      status,
      players,
      buy_in,
    } = req.body;

    if (!room_id) {
      return res.status(400).send({ message: "room_id is required" });
    }

    const game = await Game.create({
      room_id,
      status: status || 0,
      players: players || [],
      buy_in: buy_in || 0,
      start_time: new Date(),
    });

    res.status(201).send({
      success: true,
      message: "Game created successfully",
      data: game,
    });
  } catch (error) {
    console.error("Error creating game:", error);
    res.status(500).send({
      success: false,
      message: error.message || "Some error occurred while creating the Game.",
    });
  }
};

// ✅ Retrieve all Games (newest first; no limit so admin sees every game)
exports.findAll = async (req, res) => {
  try {
    const { status, room_id, limit } = req.query;

    let condition = {};
    if (status) condition.status = status;
    if (room_id) condition.room_id = room_id;

    const queryOptions = {
      where: condition,
      order: [['game_id', 'DESC']],
    };
    if (limit != null && limit !== '') {
      const num = parseInt(limit, 10);
      if (num > 0) queryOptions.limit = Math.min(num, 5000);
    }

    const games = await Game.findAll(queryOptions);
    
    // Process games to include player information and states
    const gamesWithPlayerStates = await Promise.all(
      games.map(async (game) => {
        const gameData = game.toJSON();
        
        // Fetch player information from user IDs stored in players array
        const playerUserIds = gameData.players || [];
        const players = [];
        
        for (const userId of playerUserIds) {
          try {
            const user = await db.users.findByPk(userId, {
              attributes: ['id', 'username', 'display_name']
            });
            
            if (user) {
              players.push({
                player_id: user.id,
                username: user.username || user.display_name || `User ${user.id}`,
                ready: false // Default, can be updated from player states
              });
            }
          } catch (err) {
            console.error(`Error fetching user ${userId} for game ${game.game_id}:`, err);
          }
        }
        
        gameData.players = players;
        
        // Fetch winner information if winner exists
        if (gameData.winner) {
          try {
            const winnerUser = await db.users.findByPk(gameData.winner, {
              attributes: ['id', 'username', 'display_name']
            });
            if (winnerUser) {
              gameData.winner_username = winnerUser.username || winnerUser.display_name || `User ${winnerUser.id}`;
            }
          } catch (err) {
            console.error(`Error fetching winner for game ${game.game_id}:`, err);
          }
        }
        
        // If game is active or finished, fetch player states
        if (game.status === 1 || game.status === 2) {
          try {
            const playerStates = await db.player_states.findAll({
              where: { game_id: game.game_id },
              include: [{
                model: db.users,
                as: 'user',
                attributes: ['id', 'username', 'display_name']
              }]
            });
            
            gameData.player_states = playerStates.map(ps => ({
              user_id: ps.user_id,
              username: ps.user?.username || ps.user?.display_name || `User ${ps.user_id}`,
              is_connected: ps.is_connected,
              last_action_time: ps.last_action_time,
              disconnect_time: ps.disconnect_time
            }));
            
            // Update ready status in players array based on player states
            const playerStateMap = new Map(playerStates.map(ps => [ps.user_id, ps]));
            gameData.players = gameData.players.map(p => {
              const playerState = playerStateMap.get(p.player_id);
              return {
                ...p,
                ready: playerState ? playerState.is_connected : false
              };
            });
          } catch (err) {
            console.error(`Error fetching player states for game ${game.game_id}:`, err);
            gameData.player_states = [];
          }
        } else {
          gameData.player_states = [];
        }
        
        return gameData;
      })
    );
    
    res.send({ success: true, data: gamesWithPlayerStates });
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).send({
      success: false,
      message: error.message || "Some error occurred while retrieving Games.",
    });
  }
};

// ✅ Retrieve a single Game by ID
exports.findOne = async (req, res) => {
  const id = req.params.id;
  try {
    const game = await Game.findOne({ where: { game_id: id } });
    if (!game) {
      return res.status(404).send({ success: false, message: "Game not found" });
    }
    
    const gameData = game.toJSON();
    
    // Fetch player information
    const playerUserIds = gameData.players || [];
    const players = [];
    
    for (const userId of playerUserIds) {
      try {
        const user = await db.users.findByPk(userId, {
          attributes: ['id', 'username', 'display_name']
        });
        
        if (user) {
          players.push({
            player_id: user.id,
            username: user.username || user.display_name || `User ${user.id}`,
            ready: false
          });
        }
      } catch (err) {
        console.error(`Error fetching user ${userId}:`, err);
      }
    }
    
    gameData.players = players;
    
    // Fetch winner information if winner exists
    if (gameData.winner) {
      try {
        const winnerUser = await db.users.findByPk(gameData.winner, {
          attributes: ['id', 'username', 'display_name']
        });
        if (winnerUser) {
          gameData.winner_username = winnerUser.username || winnerUser.display_name || `User ${winnerUser.id}`;
        }
      } catch (err) {
        console.error(`Error fetching winner:`, err);
      }
    }
    
    // Fetch player states if game is active or finished
    if (game.status === 1 || game.status === 2) {
      try {
        const playerStates = await db.player_states.findAll({
          where: { game_id: game.game_id },
          include: [{
            model: db.users,
            as: 'user',
            attributes: ['id', 'username', 'display_name']
          }]
        });
        
        gameData.player_states = playerStates.map(ps => ({
          user_id: ps.user_id,
          username: ps.user?.username || ps.user?.display_name || `User ${ps.user_id}`,
          is_connected: ps.is_connected,
          last_action_time: ps.last_action_time,
          disconnect_time: ps.disconnect_time
        }));
      } catch (err) {
        console.error(`Error fetching player states:`, err);
        gameData.player_states = [];
      }
    } else {
      gameData.player_states = [];
    }
    
    res.send({ success: true, data: gameData });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error retrieving Game with id=" + id,
    });
  }
};

// ✅ Update a Game by ID
exports.update = async (req, res) => {
  const id = req.params.id;
  try {
    const [updated] = await Game.update(req.body, { where: { game_id: id } });
    if (updated) {
      const game = await Game.findByPk(id);
      res.send({ success: true, message: "Game updated", data: game });
    } else {
      res.status(404).send({ success: false, message: `Game with id=${id} not found` });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error updating Game with id=" + id,
    });
  }
};

// ✅ Delete a Game by ID
exports.delete = async (req, res) => {
  const id = req.params.id;
  try {
    const deleted = await Game.destroy({ where: { game_id: id } });
    if (deleted) {
      res.send({ success: true, message: "Game deleted successfully" });
    } else {
      res.status(404).send({ success: false, message: `Game with id=${id} not found` });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Could not delete Game with id=" + id,
    });
  }
};

// ✅ Delete all Games
exports.deleteAll = async (req, res) => {
  try {
    const deletedCount = await Game.destroy({ where: {}, truncate: false });
    res.send({
      success: true,
      message: `${deletedCount} Games were deleted successfully.`,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message || "Some error occurred while removing all Games.",
    });
  }
};

// ✅ Retrieve all published games (status = 1)
exports.findAllPublished = async (req, res) => {
  try {
    const games = await Game.findAll({ where: { status: 1 } });
    res.send({ success: true, data: games });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message || "Some error occurred while retrieving published Games.",
    });
  }
};
