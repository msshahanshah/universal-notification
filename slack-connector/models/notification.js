'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
      // Define associations here if needed in the future
    }
  }

  Notification.init(
    {
      // Primary key for the notification
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true, // Automatically increment the ID
      },      
      // Unique identifier for the notification
      messageId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },

      // Identifier for the client sending the notification
      clientId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // Service responsible for sending the notification
      service: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // Destination address (e.g., email, phone number)
      destination: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // Content of the notification (stored as JSON)
      content: {
        type: DataTypes.JSONB,
        allowNull: false,
      },

      // Status of the notification (e.g., pending, sent, failed)
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending', // Default status
      },

      // Number of attempts made to send the notification
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // Response from the connector (if any)
      connectorResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // ID of the template used for the notification (optional)
      templateId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Notification',
      timestamps: true, // Enable createdAt and updatedAt fields
      tableName: 'notifications', // Explicit table name for clarity

    }
  );

  return Notification;
};