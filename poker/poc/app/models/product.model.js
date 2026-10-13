module.exports = (sequelize, Sequelize) => {
    const Product = sequelize.define("product", {
      name: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      catId: {
        type: Sequelize.INTEGER,
       
      },
      description: {
        type: Sequelize.STRING
      },
      stock: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      image: {
        type: Sequelize.STRING
      },
    });

    return Product;
  };
  