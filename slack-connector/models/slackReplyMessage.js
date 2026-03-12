"use strict";

const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize, schemaName) => {
  /**
   * @class Notification
   * @extends Model
   * @classdesc Represents a notification entity in the database.
   */
  class SlackReplyMessage extends Model {
    /**
     * @method associate
     * @description Defines associations with other models (if any).
     * @param {Object} models - The collection of models in the application.
     */
    static associate(models) {
      // Define associations here if needed in the future
    }
  }

  SlackReplyMessage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },

      parentReferenceId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      service: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      childReferenceId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userReferenceId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      workspaceChannelKey: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      userReferenceName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      content: {
        type: DataTypes.JSON,
        allowNull: false,
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "SlackReplyMessage",
      tableName: "slack_reply_messages",
      schema: schemaName.toLowerCase(),
      timestamps: true,
      paranoid: true, //perform sodt delete
      underscored: true, //It tells Sequelize to use snake_case column names in the database instead of camelCase.
    },
  );

  return SlackReplyMessage;
};
