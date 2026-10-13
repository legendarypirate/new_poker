module.exports = (sequelize, Sequelize) => {
    const Privacy = sequelize.define("privacy", {
      privacy: {
        type: Sequelize.TEXT, // Ensure it's TEXT, not STRING(255)
        allowNull: true
      }
    });
  
    return Privacy;
  };
  