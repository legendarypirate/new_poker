const db = require("../models");
const User = db.users;
const Tournament = db.tournaments;
const Withdrawal = db.withdrawals;
const Game = db.games;
const PlayerState = db.player_states;
const PlatformCharge = db.platform_charges;
const Op = db.Sequelize.Op;

// Admin login
exports.login = async (req, res) => {
  const { username, password } = req.body;
  const bcrypt = require("bcryptjs");
  const jwt = require("jsonwebtoken");
  const secretKey = 'your_secret_key';

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required!" });
  }

  try {
    const user = await User.findOne({ where: { username, role: 'admin' } });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, secretKey, { expiresIn: "24h" });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.count({ where: { role: 'user' } });
    const activeUsers = await User.count({ where: { role: 'user', is_active: '1' } });
    
    const pendingWithdrawals = await Withdrawal.count({ where: { status: 'pending' } });
    const totalWithdrawals = await Withdrawal.sum('amount', { where: { status: 'completed' } }) || 0;
    
    const activeTournaments = await Tournament.count({ where: { status: { [Op.in]: [0, 1, 2] } } });
    const totalTournaments = await Tournament.count();
    
    const activeGames = await Game.count({ where: { status: 1 } });
    const totalGames = await Game.count();

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers
        },
        withdrawals: {
          pending: pendingWithdrawals,
          totalAmount: parseFloat(totalWithdrawals)
        },
        tournaments: {
          active: activeTournaments,
          total: totalTournaments
        },
        games: {
          active: activeGames,
          total: totalGames
        }
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching dashboard statistics"
    });
  }
};

// Get all tournaments
exports.getTournaments = async (req, res) => {
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

// Get single tournament
exports.getTournament = async (req, res) => {
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

// Create tournament
exports.createTournament = async (req, res) => {
  try {
    const { tournament_name, buy_in, max_players, game_type } = req.body;

    if (!tournament_name || !buy_in || !max_players) {
      return res.status(400).json({
        success: false,
        message: "Tournament name, buy-in, and max players are required"
      });
    }

    const tournament = await Tournament.create({
      tournament_name,
      buy_in: parseInt(buy_in),
      max_players: parseInt(max_players),
      prize_pool: 0,
      status: 0,
      game_type: game_type || 'mongol_13',
      registered_players: []
    });

    res.status(201).json({
      success: true,
      message: "Tournament created successfully",
      data: tournament
    });
  } catch (error) {
    console.error("Error creating tournament:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error creating tournament"
    });
  }
};

// Update tournament
exports.updateTournament = async (req, res) => {
  try {
    const id = req.params.id;
    const tournament = await Tournament.findByPk(id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found"
      });
    }

    await tournament.update(req.body);

    res.json({
      success: true,
      message: "Tournament updated successfully",
      data: tournament
    });
  } catch (error) {
    console.error("Error updating tournament:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating tournament"
    });
  }
};

// Delete tournament
exports.deleteTournament = async (req, res) => {
  try {
    const id = req.params.id;
    const tournament = await Tournament.findByPk(id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found"
      });
    }

    await tournament.destroy();

    res.json({
      success: true,
      message: "Tournament deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting tournament:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting tournament"
    });
  }
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const condition = {};

    if (role) {
      condition.role = role;
    } else {
      condition.role = 'user';
    }

    if (search) {
      condition[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where: condition,
      attributes: ['id', 'username', 'phone', 'email', 'account_balance', 'role', 'is_active', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching users"
    });
  }
};

// Get single user
exports.getUser = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'phone', 'email', 'account_balance', 'role', 'is_active', 'createdAt']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching user"
    });
  }
};

// Update user balance
exports.updateUserBalance = async (req, res) => {
  try {
    const id = req.params.id;
    const { amount, operation } = req.body; // operation: 'add' or 'subtract'

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const currentBalance = parseFloat(user.account_balance) || 0;
    const changeAmount = parseFloat(amount) || 0;

    let newBalance;
    if (operation === 'add') {
      newBalance = currentBalance + changeAmount;
    } else if (operation === 'subtract') {
      newBalance = Math.max(0, currentBalance - changeAmount);
    } else {
      newBalance = changeAmount; // Set directly
    }

    await user.update({
      account_balance: newBalance
    });

    res.json({
      success: true,
      message: "User balance updated successfully",
      data: {
        id: user.id,
        username: user.username,
        previous_balance: currentBalance,
        new_balance: newBalance
      }
    });
  } catch (error) {
    console.error("Error updating user balance:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating user balance"
    });
  }
};

// Get all withdrawals
exports.getWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const condition = {};

    if (status) {
      condition.status = status;
    }

    const withdrawals = await Withdrawal.findAll({
      where: condition,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'phone', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({
      success: true,
      data: withdrawals
    });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching withdrawals"
    });
  }
};

// Approve withdrawal
exports.approveWithdrawal = async (req, res) => {
  try {
    const id = req.params.id;
    const { admin_notes, processed_by } = req.body;

    // Try to find by withdrawal_id first, then by id
    let withdrawal = await Withdrawal.findOne({ where: { withdrawal_id: id } });
    if (!withdrawal) {
      withdrawal = await Withdrawal.findByPk(id);
    }
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found"
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Withdrawal request is not pending"
      });
    }

    await withdrawal.update({
      status: 'completed',
      admin_notes: admin_notes || withdrawal.admin_notes,
      processed_by: processed_by || withdrawal.processed_by,
      processed_at: new Date()
    });

    res.json({
      success: true,
      message: "Withdrawal approved successfully",
      data: withdrawal
    });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error approving withdrawal"
    });
  }
};

// Reject withdrawal
exports.rejectWithdrawal = async (req, res) => {
  try {
    const id = req.params.id;
    const { admin_notes, processed_by } = req.body;

    // Try to find by withdrawal_id first, then by id
    let withdrawal = await Withdrawal.findOne({ where: { withdrawal_id: id } });
    if (!withdrawal) {
      withdrawal = await Withdrawal.findByPk(id);
    }
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found"
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Withdrawal request is not pending"
      });
    }

    // Refund amount to user
    const user = await User.findByPk(withdrawal.user_id);
    if (user) {
      const currentBalance = parseFloat(user.account_balance) || 0;
      await user.update({
        account_balance: currentBalance + parseFloat(withdrawal.amount)
      });
    }

    await withdrawal.update({
      status: 'rejected',
      admin_notes: admin_notes || withdrawal.admin_notes,
      processed_by: processed_by || withdrawal.processed_by,
      processed_at: new Date()
    });

    res.json({
      success: true,
      message: "Withdrawal rejected and amount refunded",
      data: withdrawal
    });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error rejecting withdrawal"
    });
  }
};

// End game (force finish)
exports.endGame = async (req, res) => {
  try {
    const gameId = req.params.id;

    // Find the game
    const game = await Game.findByPk(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found"
      });
    }

    // Check if game is already finished
    if (game.status === 2) {
      return res.status(400).json({
        success: false,
        message: "Game is already finished"
      });
    }

    // Update game status to finished
    await game.update({
      status: 2, // finished
      end_time: new Date()
    });

    // Clear all player states for this game
    await PlayerState.destroy({
      where: { game_id: gameId }
    });

    // Clear current_game_id for all users in this game
    await User.update(
      { current_game_id: null },
      { where: { current_game_id: gameId } }
    );

    console.log(`✅ Admin force-ended game ${gameId}`);

    res.json({
      success: true,
      message: "Game ended successfully",
      data: {
        game_id: gameId,
        status: 2,
        end_time: game.end_time
      }
    });
  } catch (error) {
    console.error("Error ending game:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error ending game"
    });
  }
};

// Get platform charges with date range filter
exports.getPlatformCharges = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereCondition = {};
    
    // Add date range filter if provided
    if (startDate || endDate) {
      whereCondition.created_at = {};
      if (startDate) {
        whereCondition.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire end date
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereCondition.created_at[Op.lte] = end;
      }
    }
    
    const charges = await PlatformCharge.findAll({
      where: whereCondition,
      include: [{
        model: Game,
        as: 'game',
        attributes: ['game_id', 'room_id', 'buy_in', 'game_type', 'start_time', 'end_time', 'winner'],
        include: [{
          model: User,
          as: 'winnerUser',
          attributes: ['id', 'username', 'display_name'],
          required: false
        }]
      }],
      order: [['created_at', 'DESC']]
    });
    
    // Calculate totals
    const totals = charges.reduce((acc, charge) => {
      acc.totalPot += parseFloat(charge.total_pot) || 0;
      acc.totalPlatformFee += parseFloat(charge.platform_fee) || 0;
      acc.totalWinnerPayout += parseFloat(charge.winner_payout) || 0;
      acc.count += 1;
      return acc;
    }, {
      totalPot: 0,
      totalPlatformFee: 0,
      totalWinnerPayout: 0,
      count: 0
    });
    
    res.json({
      success: true,
      data: charges,
      totals
    });
  } catch (error) {
    console.error("Error fetching platform charges:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching platform charges"
    });
  }
};

