// ./notification-api/migrations/YYYYMMDDHHMMSS-create-notification.js
'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Notifications', {
      id: { // Use standard integer ID as primary key
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
      target: { // e.g., Slack channel, email address, Telegram chat ID
        type: Sequelize.STRING,
        allowNull: false
      },
      content: { // The message body
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: { // pending, processing, sent, failed
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
        // Add index for faster status lookups
        // index: true // Handled below
      },
      attempts: { // Number of processing attempts
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      connectorResponse: { // Store response/error from connector
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW // Use Sequelize.NOW for default
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

     // Add specific indexes after table creation
    await queryInterface.addIndex('Notifications', ['messageId'], { unique: true });
    await queryInterface.addIndex('Notifications', ['status']);
    await queryInterface.addIndex('Notifications', ['service', 'status']); // Useful for finding pending tasks per service
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Notifications');
    // No need to remove indexes explicitly when dropping the table
  }
};