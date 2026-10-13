module.exports = (sequelize, Sequelize) => {
    const Word = sequelize.define("word", {
      word: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      catId: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      meaning: {
        type: Sequelize.STRING
      },
      like: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      dislike: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
    });
  
    return Word;
  };
  