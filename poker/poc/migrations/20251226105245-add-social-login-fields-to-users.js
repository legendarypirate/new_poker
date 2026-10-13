'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('users');
    
    if (!tableDescription.firebase_uid) {
      await queryInterface.addColumn('users', 'firebase_uid', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      });
    }
    if (!tableDescription.display_name) {
      await queryInterface.addColumn('users', 'display_name', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    if (!tableDescription.provider) {
      await queryInterface.addColumn('users', 'provider', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    if (!tableDescription.avatar_url) {
      await queryInterface.addColumn('users', 'avatar_url', {
        type: Sequelize.STRING(500),
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'firebase_uid');
    await queryInterface.removeColumn('users', 'display_name');
    await queryInterface.removeColumn('users', 'provider');
    await queryInterface.removeColumn('users', 'avatar_url');
  }
};

