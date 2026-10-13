'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('games', 'game_type', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'mongol_13'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('games', 'game_type');
  }
};

