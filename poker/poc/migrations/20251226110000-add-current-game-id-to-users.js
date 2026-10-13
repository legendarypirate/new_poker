'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('users');
    
    if (!tableDescription.current_game_id) {
      await queryInterface.addColumn('users', 'current_game_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'current_game_id');
  }
};

