module.exports = (sequelize, Sequelize) => {
  const Category = sequelize.define("category", {
    name: {
      type: Sequelize.STRING
    },
    is_shown: {
      type: Sequelize.STRING
    },
    parent_id: {
      type: Sequelize.INTEGER,
    },
  });

  return Category;
};
