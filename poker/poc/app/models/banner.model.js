module.exports = (sequelize, Sequelize) => {
    const Banner = sequelize.define("banner", {
      text: {
        type: Sequelize.STRING
      },
      link: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
      image: {
        type: Sequelize.STRING,
        defaultValue: 0
      },
    
    });
  
    return Banner;
  };
  