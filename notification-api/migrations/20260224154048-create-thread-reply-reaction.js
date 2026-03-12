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
      tableName: "thread_reply_reactions",
      schema: schemaName,
    };
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },

      thread_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      message: {
        type: Sequelize.ARRAY(Sequelize.STRING),
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

    await queryInterface.addIndex(tableName, ["thread_id", "deleted_at"]);
    await queryInterface.addIndex(tableName, ["thread_id", "user_id"], {
      unique: true,
      name: "thread_id_user_id_unique_cidx",
    });
  },

  /**
   * @param {QueryInterface} queryInterface
   * @param {Sequelize} Sequelize
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("thread_reply_reactions");
  },
};
