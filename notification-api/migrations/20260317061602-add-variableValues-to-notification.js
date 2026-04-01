'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: 'notifications',
      schema: schemaName,
    };

    await queryInterface.addColumn(tableName, 'variableValues', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });
  },

  async down(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: 'notifications',
      schema: schemaName,
    };

    await queryInterface.removeColumn(tableName, 'variableValues');
  },
};
