module.exports = (sequelize, Sequelize) => {
  const Withdrawal = sequelize.define("withdrawal", {
    withdrawal_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    amount: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    },
    status: {
      type: Sequelize.ENUM('pending', 'approved', 'rejected', 'completed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    bank_account: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    bank_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    account_holder_name: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    phone: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    admin_notes: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    processed_by: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    processed_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  });

  return Withdrawal;
};

