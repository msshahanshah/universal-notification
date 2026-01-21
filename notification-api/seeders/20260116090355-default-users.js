"use strict";
const defaultPassword = require("../helpers/defaultPassword.helper");
const { loadClientSecret } = require("../src/utillity/awsSecretManager");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const targetSchema = "public";
    const tableName = {
      tableName: "users",
      schema: targetSchema,
    };
    try {
      const clients = await loadClientSecret();

      if (!Array.isArray(clients) || clients.length === 0) {
        throw new Error("No client found!");
      }

      const defaultUsername = clients.map((client) => client.ID.toLowerCase());

      if (!defaultUsername || defaultUsername.length === 0) {
        throw new Error("No client found");
      }

      const defaultUsers = await Promise.all(
        defaultUsername.map(async (user) => {
          return {
            username: `admin@${user}`,
            password: await defaultPassword(`admin@${user}`),
          };
        })
      );

      await queryInterface.bulkInsert(tableName, defaultUsers);
    } catch (error) {
      console.error("Seeder failed:", error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("users");
  },
};
