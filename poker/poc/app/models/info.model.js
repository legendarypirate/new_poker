module.exports = (sequelize, Sequelize) => {
  const Info = sequelize.define("info", {
    description: {
      type: Sequelize.STRING
    },
    doctor: {
      type: Sequelize.STRING,
      defaultValue: 0
    },
    image: {
      type: Sequelize.STRING,
      defaultValue: 0
    },
    audio: {
      type: Sequelize.STRING,
      defaultValue: 0
    },
    title: {
      type: Sequelize.STRING,
      defaultValue: 0
    },
    isactive: {
      type: Sequelize.STRING,
      defaultValue: 1
    },
    gender: {
      type: Sequelize.STRING,
      defaultValue: 0
    },
    age: {
      type: Sequelize.STRING,
      defaultValue: 0
    },
    cat_id: {
      type: Sequelize.INTEGER,
      references: {
        model: 'categories',
        key: 'id'
      }
    }
  });

  return Info;
};
