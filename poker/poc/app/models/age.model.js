module.exports = (sequelize, Sequelize) => {
    const Age = sequelize.define("age", {
      age: {
        type: Sequelize.STRING
      },
    
    
    });
  
    return Age;
  };
  