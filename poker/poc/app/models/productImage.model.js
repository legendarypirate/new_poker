// models/productImage.js

module.exports = (sequelize, DataTypes) => {
    const ProductImage = sequelize.define("ProductImage", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: false,
      }
    });
  
    ProductImage.associate = function(models) {
      ProductImage.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product'
      });
    };
  
    return ProductImage;
  };
  