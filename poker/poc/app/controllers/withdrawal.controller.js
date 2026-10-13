const db = require("../models");
const Withdrawal = db.withdrawals;
const User = db.users;
const Op = db.Sequelize.Op;

// Create a new withdrawal request
exports.create = async (req, res) => {
  try {
    const { amount, bank_account, bank_name, account_holder_name, phone } = req.body;
    const user_id = req.user?.id || req.body.user_id; // Use token user_id if available

    if (!user_id || !amount) {
      return res.status(400).json({
        success: false,
        message: "User ID and amount are required"
      });
    }

    // Validate amount
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal amount"
      });
    }

    // Check user exists and get balance
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const accountBalance = parseFloat(user.account_balance) || 0;
    if (accountBalance < withdrawalAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance"
      });
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      user_id,
      amount: withdrawalAmount,
      status: 'pending',
      bank_account,
      bank_name,
      account_holder_name,
      phone,
    });

    // Deduct amount from user balance (hold it)
    await user.update({
      account_balance: accountBalance - withdrawalAmount
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request created successfully",
      data: withdrawal
    });
  } catch (error) {
    console.error("Error creating withdrawal:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error creating withdrawal request"
    });
  }
};

// Get all withdrawal requests (with filters)
exports.findAll = async (req, res) => {
  try {
    const { status, user_id } = req.query;
    const condition = {};

    // If user is not admin, only show their own withdrawals
    if (req.user && req.user.role !== 'admin') {
      condition.user_id = req.user.id;
    } else if (user_id) {
      // Admin can filter by user_id
      condition.user_id = user_id;
    }

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
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: withdrawals
    });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching withdrawal requests"
    });
  }
};

// Get a single withdrawal request
exports.findOne = async (req, res) => {
  try {
    const id = req.params.id;
    // Try to find by withdrawal_id first, then by id
    let withdrawal = await Withdrawal.findOne({ 
      where: { withdrawal_id: id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'phone', 'email', 'account_balance']
      }]
    });
    if (!withdrawal) {
      withdrawal = await Withdrawal.findByPk(id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'phone', 'email', 'account_balance']
        }]
      });
    }

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found"
      });
    }

    res.json({
      success: true,
      data: withdrawal
    });
  } catch (error) {
    console.error("Error fetching withdrawal:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching withdrawal request"
    });
  }
};

// Update withdrawal status (approve/reject)
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const { status, admin_notes, processed_by } = req.body;

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

    // If rejecting, refund the amount to user
    if (status === 'rejected' && withdrawal.status === 'pending') {
      const user = await User.findByPk(withdrawal.user_id);
      if (user) {
        const currentBalance = parseFloat(user.account_balance) || 0;
        await user.update({
          account_balance: currentBalance + parseFloat(withdrawal.amount)
        });
      }
    }

    // Update withdrawal
    await withdrawal.update({
      status: status || withdrawal.status,
      admin_notes: admin_notes || withdrawal.admin_notes,
      processed_by: processed_by || withdrawal.processed_by,
      processed_at: status !== 'pending' ? new Date() : withdrawal.processed_at
    });

    res.json({
      success: true,
      message: "Withdrawal request updated successfully",
      data: withdrawal
    });
  } catch (error) {
    console.error("Error updating withdrawal:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating withdrawal request"
    });
  }
};

// Delete a withdrawal request
exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
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

    // If pending, refund the amount
    if (withdrawal.status === 'pending') {
      const user = await User.findByPk(withdrawal.user_id);
      if (user) {
        const currentBalance = parseFloat(user.account_balance) || 0;
        await user.update({
          account_balance: currentBalance + parseFloat(withdrawal.amount)
        });
      }
    }

    await withdrawal.destroy();

    res.json({
      success: true,
      message: "Withdrawal request deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting withdrawal:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting withdrawal request"
    });
  }
};

