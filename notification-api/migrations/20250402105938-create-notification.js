// ./notification-api/migrations/YYYYMMDDHHMMSS-create-notification.js
'use strict';

/**
 * @typedef {import('sequelize').QueryInterface} QueryInterface
 * @typedef {import('sequelize').Sequelize} Sequelize
 * @typedef {import('sequelize-cli').Migration} Migration
 */

/**
 * @type {Migration}
 */
module.exports = {
  /**
   * @param {QueryInterface} queryInterface 
   * @param {Sequelize} Sequelize 
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Notifications', {
      id: { 
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      messageId: { // Unique ID for idempotency
        type: Sequelize.UUID, // Use UUID type
        allowNull: false,
        unique: true // Ensure uniqueness
      },
      service: { 
        type: Sequelize.STRING,
        allowNull: false,
      },
      target: { 
        type: Sequelize.STRING,
        allowNull: false
      },
      content: { 
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: { 
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      attempts: { 
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      connectorResponse: { 
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW 
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('Notifications', ['messageId'], { unique: true });
    await queryInterface.addIndex('Notifications', ['status']);
    await queryInterface.addIndex('Notifications', ['service', 'status']); 
  },
  /**
   * @param {QueryInterface} queryInterface 
   * @param {Sequelize} Sequelize 
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Notifications');
    // No need to remove indexes explicitly when dropping the table
  }
};