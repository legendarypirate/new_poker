module.exports = (sequelize, Sequelize) => {
  const FriendRequest = sequelize.define("friend_request", {
    from_user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    to_user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    status: {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
  });

  return FriendRequest;
};
