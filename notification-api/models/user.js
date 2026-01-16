"use strict";

const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize, schemaName) => {
  /**
   * @class Notification
   * @extends Model
   * @classdesc Represents a notification entity in the database.
   */
  class User extends Model {
    /**
     * @method associate
     * @description Defines associations with other models (if any).
     * @param {Object} models - The collection of models in the application.
     */
    static associate(models) {
      // Define associations here if needed in the future
    }
  }

  User.init(
    {
      // Primary key for the notification
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true, // Automatically increment the ID
      },
      // Unique identifier for the notification
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },

    {
      sequelize,
      modelName: "User",
      timestamps: true, // Enable createdAt and updatedAt fields
      underscored: true,
      tableName: "users", // Explicit table name for clarity
      schema: schemaName.toLowerCase(), // Use lowercase schema name
    }
  );

  return User;
};
