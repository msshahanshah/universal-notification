'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: 'slack_reply_messages',
      schema: schemaName,
    };

    await queryInterface.changeColumn(tableName, 'parent_reference_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('slack_reply_messages', 'parent_reference_id', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
