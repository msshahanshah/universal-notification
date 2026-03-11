'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize, schemaName) => {
  class Template extends Model {
    static associate(models) {
      // define associations here if needed
    }
  }

  Template.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      templateId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "template_id",
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      service: {
        type: DataTypes.ENUM("slack", "sms", "email", "whatsapp"),
        allowNull: false,
      },

      messageContent: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "message_content",
      },

      requiredFields: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        field: "required_fields",
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at",
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "deleted_at",
      },
    },
    {
      sequelize,
      modelName: "Template",
      tableName: "templates",
      schema: schemaName.toLowerCase(),
      timestamps: true,
      underscored: true,
      paranoid: true,

      indexes: [
        {
          unique: true,
          fields: ['service', 'name']
        }
      ]
    }
  );

  return Template;
};