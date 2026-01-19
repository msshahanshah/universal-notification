"use strict";
const fs = require("fs").promises;
const path = require("path");
const defaultPassword = require("../helpers/defaultPassword.helper");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const targetSchema = "public";
    const tableName = {
      tableName: "users",
      schema: targetSchema,
    };
    try {
      const clientDetailFilePath = path.join(
        process.cwd(),
        "..",
        "clientList.json"
      );

      const clients = JSON.parse(
        await fs.readFile(clientDetailFilePath, "utf-8")
      );

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
            username: `${user}@admin`,
            password: await defaultPassword(user),
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
