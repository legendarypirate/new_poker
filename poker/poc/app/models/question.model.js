module.exports = (sequelize, Sequelize) => {
    const Question = sequelize.define("questions", {
      phone: {
        type: Sequelize.STRING
      },
      question: {
        type: Sequelize.TEXT
      },
    });
  
    return Question;
  };
  