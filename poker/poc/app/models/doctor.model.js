module.exports = (sequelize, Sequelize) => {
    const Doctor = sequelize.define("doctor", {
      prof: {
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
      image: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
    
    });
  
    return Doctor;
  };
  