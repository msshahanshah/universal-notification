"use strict";

const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize, schemaName) => {
  /**
   * @class Notification
   * @extends Model
   * @classdesc Represents a notification entity in the database.
   */
  class ThreadReplyMessage extends Model {
    /**
     * @method associate
     * @description Defines associations with other models (if any).
     * @param {Object} models - The collection of models in the application.
     */
    static associate(models) {
      // Define associations here if needed in the future
    }
  }

  ThreadReplyMessage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },

      parentThreadId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      childThreadId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      message: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "ThreadReplyMessage",
      tableName: "thread_reply_messages",
      schema: schemaName.toLowerCase(),
      timestamps: true,
      paranoid: true, //perform sodt delete
      underscored: true, //It tells Sequelize to use snake_case column names in the database instead of camelCase.
    },
  );

  return ThreadReplyMessage;
};
