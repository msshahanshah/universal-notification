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
    const tableName = {
      tableName: "slack_reply_messages",
      schema: schemaName,
    };
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },

      parent_reference_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      service: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      child_reference_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      user_reference_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      user_reference_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      workspace_channel_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      content: {
        type: Sequelize.JSON,
        allowNull: false,
      },

      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for better query performance

    await queryInterface.addIndex(
      tableName,
      [
        "parent_reference_id",
        "child_reference_id",
        "service",
        "workspace_channel_key",
        "deleted_at",
      ],
      {
        name: "parent_reference_id_child_reference_id_service_workspace_channel_key_deleted_at_slack_reply_messages_cidx",
      },
    );
    await queryInterface.addIndex(
      tableName,
      [
        "parent_reference_id",
        "user_reference_id",
        "service",
        "workspace_channel_key",
        "child_reference_id",
        "deleted_at",
      ],
      {
        unique: true,
        name: "parent_reference_id_user_reference_id_service_workspace_channel_key_child_reference_id_deleted_at_slack_reply_messages_cidx",
      },
    );
  },

  /**
   * @param {QueryInterface} queryInterface
   * @param {Sequelize} Sequelize
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("slack_reply_messages");
  },
};
