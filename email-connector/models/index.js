'use strict';

// This file is the entry point for the Sequelize ORM setup. It reads the model files,
// creates a Sequelize instance, and exports the database connection and models.

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);


/**
 * @param {string} env - The environment (e.g., 'development', 'test', 'production').
 * @returns {object} - The database models.
 */
module.exports = (env) => {
  /**
   * @type {object} - Configuration for the database, based on the current environment.
   */
  const dbConfig = require('../config/database.js')[env];  // Load the database configuration

  /**
   * @type {object} - An empty object that will store the database models.
   */
  const db = {};

  /**
   * @type {Sequelize} - The Sequelize instance for the database connection.
   */
  let sequelize;
  /** Initializes a new Sequelize instance using environment variables or configuration file. */
  if (dbConfig.use_env_variable) {
    sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
  } else {
    /** Initializes a new Sequelize instance using the configuration file. */
    sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
  }

  fs
    .readdirSync(__dirname)
    .filter(file => {
      return (file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js' && file.indexOf('.test.js') === -1);
    })
    .forEach(file => {
      /** Creates and adds a model to the database object. */
      const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
    });

  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
  return db;
};
