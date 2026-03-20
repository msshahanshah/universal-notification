'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize, schemaName) {
    const tableName = {
      tableName: "templates",
      schema: schemaName,
    };
    await queryInterface.createTable(tableName, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      template_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      service: {
        type: Sequelize.ENUM("slack", "sms", "email", "whatsapp"),
        allowNull: false,
      },
      message_content: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      required_fields: {
        type: Sequelize.JSON, 
        allowNull: true,
        defaultValue: [],
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

    await queryInterface.addConstraint(tableName, {
      fields: ["service", "name", "deleted_at"],
      type: "unique",
      name: "unique_service_name_templates"
    });

    await queryInterface.addConstraint(tableName, {
      fields: ["template_id",  "deleted_at"],
      type: "unique",
      name: "unique_templateId"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('templates');
  }
};