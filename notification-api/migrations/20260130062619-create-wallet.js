'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: "routing_rules",
      schema: schemaName,
    };
    await queryInterface.createTable(tableName, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING(5)
      },
      service: {
        allowNull: false,
        type: Sequelize.ENUM("SMS", "EMAIL", "SLACK")
      },
      provider: {
        allowNull: false,
        type: Sequelize.STRING
      },
      balance: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      balance_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
        defaultValue: null,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('wallets');
  }
};