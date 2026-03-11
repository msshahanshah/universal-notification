"use strict";

/**
 * @typedef {import('sequelize').QueryInterface} QueryInterface
 * @typedef {import('sequelize').Sequelize} Sequelize
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = {
      tableName: "notifications",
      schema: "gkmit", // change if schema dynamic
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

  async down(queryInterface, Sequelize) {
    const tableName = {
      tableName: "notifications",
      schema: "gkmit",
    };

    await queryInterface.removeColumn(tableName, "referenceId");
    await queryInterface.removeColumn(tableName, "deletedAt");
  },
};
