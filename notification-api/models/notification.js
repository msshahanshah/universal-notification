// ./notification-api/models/notification.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  /**
   * @class Notification
   * @extends Model
   * @classdesc Represents a notification entity in the database.
   */
  class Notification extends Model {
    /**
     * @method associate
     * @description Defines associations with other models (if any).
     * @param {Object} models - The collection of models in the application.
     */
    static associate(models) {
      // Define association here if needed in the future
    }
  }
  Notification.init({
    // id: is automatically added by sequelize if not defined here
    messageId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    service: {
        type: DataTypes.STRING,
        allowNull: false
    },
    target: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending' // pending, processing, sent, failed
    },
    attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    connectorResponse: {
        type: DataTypes.TEXT,
        allowNull: true
    },
      /**
     * @property {string} templateId - The ID of the template used for the notification.
     * @type {DataTypes.STRING}
     */
    templateId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    /**
     * @property {object} message - The data that replaces placeholders in the template.
     * @type {DataTypes.JSON}
     */
    message: {
      type: DataTypes.JSON,
      allowNull: true,
    }
    // createdAt and updatedAt are automatically managed by Sequelize if timestamps: true (default)
  }, {
    sequelize,
    modelName: 'Notification',
    // timestamps: true // This is the default
  });
  return Notification;
};