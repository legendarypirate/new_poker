module.exports = (sequelize, Sequelize) => {
  const Game = sequelize.define("game", {
    game_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    room_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    status: {
      type: Sequelize.INTEGER,
      defaultValue: 0, // 0=pending, 1=active, 2=finished
    },
    players: {
      type: Sequelize.JSON, // array of player IDs
      allowNull: true,
      defaultValue: [],
    },
    buy_in: {
      type: Sequelize.INTEGER, // buy-in amount in chips or currency
      allowNull: false,
      defaultValue: 0,
    },
    game_type: {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'mongol_13', // default game type
    },
    start_time: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    end_time: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    winner: {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'User ID of the game winner'
    },
    room_key: {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'WebSocket room id for spectate (e.g. cash_20k, room_1)'
    },
  });

  return Game;
};
