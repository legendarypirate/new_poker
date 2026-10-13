module.exports = (sequelize, Sequelize) => {
  const UserStatistics = sequelize.define("user_statistics", {
    stat_id: {
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
    games_played: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    games_won: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    game_type: {
      type: Sequelize.STRING,
      allowNull: true, // e.g., 'mongol_13', 'texas', 'omaha'
    },
    buy_in: {
      type: Sequelize.INTEGER,
      allowNull: true, // buy-in amount used
    },
    last_played_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'user_statistics',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'game_type', 'buy_in'],
        name: 'unique_user_game_buyin'
      }
    ]
  });

  return UserStatistics;
};

