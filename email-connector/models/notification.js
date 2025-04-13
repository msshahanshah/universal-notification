// ./email-connector/models/notification.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  /**
    * @class Notification
    * @extends Model
    * @classdesc Represents a notification entity in the database for the email connector.
    */
  class Notification extends Model {
    /**
     * @method associate 
     * @description Defines associations with other models (if any).
     * @param {Object} models - The collection of models in the application.
     */
    static associate(models) {
      // Define association here if needed in the future.
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
    templateId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    message: {
        type: DataTypes.JSON,
        allowNull: true
    }
    // createdAt and updatedAt are automatically handled by Sequelize if `timestamps: true` (default).
  }, {
    sequelize,
    /**
      * @property {string} modelName - The name of the model in Sequelize.
      * @default 'Notification'
      */
    modelName: 'Notification',
    /**
      * @property {boolean} timestamps - Indicates whether to include `createdAt` and `updatedAt` timestamps.
      * @default true
      */
    // timestamps: true // This is the default
  });
  return Notification;
};