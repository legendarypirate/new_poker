module.exports = (sequelize, Sequelize) => {
  const PlayerState = sequelize.define("player_state", {
    id: {
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
    game_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'games',
        key: 'game_id'
      }
    },
    is_connected: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    last_action_time: {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW,
    },
    disconnect_time: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'player_states',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'game_id'],
        name: 'unique_user_game'
      }
    ]
  });

  return PlayerState;
};

