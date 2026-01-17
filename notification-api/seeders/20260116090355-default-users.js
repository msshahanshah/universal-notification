"use strict";

const defaultPassword = require("../helpers/defaultPassword.helper");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const defaultUsername = ["gkmit", "accel"];

    const defaultUsers = await Promise.all(
      defaultUsername.map(async (user) => {
        return {
          username: user,
          password: await defaultPassword(user),
        };
      })
    );

    await queryInterface.bulkInsert("users", defaultUsers);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("users");
  },
};
