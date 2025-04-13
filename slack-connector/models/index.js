'use strict';

/**
 * @fileoverview This file is the entry point for the Sequelize ORM setup. It reads the model files,
 * creates a Sequelize instance, and exports the database connection and models.
 */
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
/**
 * @type {object} - Configuration for the database, based on the current environment.
 */
const config = require(__dirname + '/../config/config.js')[env];
/**
 * @type {object} - An empty object that will store the database models.
 */
const db = {};

/**
 * @type {Sequelize} - The Sequelize instance for the database connection.
 */
let sequelize;
/**
 * Initializes a new Sequelize instance using environment variables or configuration file.
 */
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  /** Initializes a new Sequelize instance using the configuration file. */
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    /** Creates and adds a model to the database object. */
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

/**
 * Iterates over each model and calls the associate method if it exists.
 */
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

/**
 * @property {Sequelize} sequelize - The Sequelize instance.
 * @property {object} Sequelize - The Sequelize module.
 */
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
