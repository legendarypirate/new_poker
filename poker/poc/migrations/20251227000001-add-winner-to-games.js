'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('games');
    
    if (!tableDescription.winner) {
      await queryInterface.addColumn('games', 'winner', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: 'User ID of the game winner'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('games', 'winner');
  }
};

