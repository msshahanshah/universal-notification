'use strict';

/**
 * @fileoverview This file sets up Sequelize models for a provided Sequelize instance.
 * It reads model files, initializes them with the given Sequelize instance, and returns
 * the database object containing the models and Sequelize instance.
 */

const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

/**
 * Initializes Sequelize models for a given Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for the database connection.
 * @param {object} Sequelize - The Sequelize module (for DataTypes).
 * @returns {object} - The database object containing models, sequelize instance, and Sequelize module.
 */
module.exports = (sequelize, Sequelize,schemaName) => {
  const db = {};

  // Read and initialize model files
  fs.readdirSync(__dirname)
    .filter(file => (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    ))
    .forEach(file => {
      const model = require(path.join(__dirname, file))(sequelize,schemaName);
      db[model.name] = model;
    });

  // Call associate methods for models, if they exist
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  // Attach sequelize instance and Sequelize module to the db object
  db.sequelize = sequelize;
  db.Sequelize = Sequelize;

  return db;
};