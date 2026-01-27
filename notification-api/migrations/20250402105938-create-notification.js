"use strict";

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
  async up(queryInterface, Sequelize, schemaName) {
    console.log("schemaTesting", schemaName);
    const tableName = {
      tableName: "notifications",
      schema: schemaName,
    };
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      messageId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      },
      service: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      destination: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending",
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      connectorResponse: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      templateId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex(tableName, ["messageId"], { unique: true });
    await queryInterface.addIndex(tableName, ["status"]);
    await queryInterface.addIndex(tableName, ["service", "status"]);
  },

  /**
   * @param {QueryInterface} queryInterface
   * @param {Sequelize} Sequelize
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("notifications");
  },
};
