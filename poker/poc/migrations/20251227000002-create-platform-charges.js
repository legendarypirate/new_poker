'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('platform_charges', {
      charge_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      game_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'games',
          key: 'game_id'
        },
        onDelete: 'CASCADE'
      },
      total_pot: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Total amount in the pot (sum of all buy-ins)'
      },
      platform_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Platform fee (5% of total pot)'
      },
      winner_payout: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Amount paid to winner (total pot - platform fee)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('platform_charges', ['game_id']);
    await queryInterface.addIndex('platform_charges', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('platform_charges');
  }
};

