module.exports = (sequelize, Sequelize) => {
  const PlatformCharge = sequelize.define("platform_charge", {
    charge_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    game_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'games',
        key: 'game_id'
      }
    },
    total_pot: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Total amount in the pot (sum of all buy-ins)'
    },
    platform_fee: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Platform fee (5% of total pot)'
    },
    winner_payout: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Amount paid to winner (total pot - platform fee)'
    },
  }, {
    tableName: 'platform_charges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return PlatformCharge;
};

