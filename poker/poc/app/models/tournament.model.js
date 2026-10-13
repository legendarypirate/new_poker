module.exports = (sequelize, Sequelize) => {
  const Tournament = sequelize.define("tournament", {
    tournament_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tournament_name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    buy_in: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    prize_pool: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    max_players: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 8,
    },
    registered_players: {
      type: Sequelize.JSON,
      defaultValue: [],
    },
    status: {
      type: Sequelize.INTEGER,
      defaultValue: 0, // 0=waiting, 1=starting, 2=active, 3=finished
    },
    game_type: {
      type: Sequelize.STRING,
      defaultValue: 'mongol_13',
    },
    start_time: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    end_time: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    bracket: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    winners: {
      type: Sequelize.JSON,
      allowNull: true,
    },
  });

  return Tournament;
};

