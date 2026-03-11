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
      service: {
        allowNull: false,
        type: Sequelize.ENUM("SMS", "EMAIL", "SLACK", "WHATSAPP")
      },
      provider: {
        allowNull: false,
        type: Sequelize.STRING
      },
      match_key: {
        allowNull: false,
        type: Sequelize.STRING
      },
      match_value: {
        allowNull: false,
        type: Sequelize.STRING
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

    // Composite unique constraint
    await queryInterface.addConstraint(tableName, {
      fields: ['service', 'match_value','deleted_at'],
      type: 'unique',
      name: 'unique_service_match_value'
    });
  },

  async down(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: "routing_rules",
      schema: schemaName,
    };

    await queryInterface.dropTable(tableName);
  }
};