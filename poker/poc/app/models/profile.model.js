module.exports = (sequelize, Sequelize) => {
    const Profile = sequelize.define("profile", {
      lastname: {
        type: Sequelize.STRING
      },
      firstname: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
      email: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
      role: {
        type: Sequelize.STRING,
        defaultValue: 'user'
      },
      phone: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isactive: {
        type: Sequelize.STRING,
        defaultValue: 1
      },
      school: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
      member_type: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
      start_date: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
      end_date: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
    
    });
    return Profile;
  };
  