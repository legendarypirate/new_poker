module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define("user", {
      username: {
        type: Sequelize.STRING
      },
      password: {
        type: Sequelize.STRING
      },
      role: {
        type: Sequelize.STRING
      },
      phone: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      otp: {
        type: Sequelize.STRING
      },
      school: {
        type: Sequelize.STRING
      },
      end_date: {
        type: Sequelize.STRING
      },
      is_active: {
        type: Sequelize.STRING
      },
      gender: {
        type: Sequelize.STRING
      },
      phone_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false, // Default: phone is not verified
      },
      account_balance: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      firebase_uid: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      display_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      avatar_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      current_game_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
    });
  
    return User;
  };
  