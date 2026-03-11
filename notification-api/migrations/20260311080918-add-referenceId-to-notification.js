"use strict";

/**
 * @typedef {import('sequelize').QueryInterface} QueryInterface
 * @typedef {import('sequelize').Sequelize} Sequelize
 */

module.exports = {
  async up(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: "notifications",
      schema: schemaName,
    };

    await queryInterface.addColumn(tableName, "referenceId", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn(tableName, "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: "notifications",
      schema: schemaName,
    };

    await queryInterface.removeColumn(tableName, "referenceId");
    await queryInterface.removeColumn(tableName, "deletedAt");
  },
};
