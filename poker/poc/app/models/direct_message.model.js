module.exports = (sequelize, Sequelize) => {
  const DirectMessage = sequelize.define("direct_message", {
    from_user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    to_user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    text: {
      type: Sequelize.STRING(1000),
      allowNull: false,
    },
    room_code: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    room_mode: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  });

  return DirectMessage;
};
