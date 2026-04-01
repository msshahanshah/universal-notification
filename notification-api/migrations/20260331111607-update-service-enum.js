'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize, schemaName) {
    // 1. Add the value to the ENUM type in the database
    // We use raw query because 'changeColumn' doesn't always handle 
    // existing Postgres ENUM updates cleanly.
    await queryInterface.sequelize.query(
      `ALTER TYPE "${schemaName}"."enum_routing_rules_service" ADD VALUE IF NOT EXISTS 'WHATSAPP'`
    );
  },

  async down(queryInterface, Sequelize, schemaName) {
    /**
     * Note: PostgreSQL does not support removing values from an ENUM easily.
     * To undo this, you would typically have to recreate the entire type,
     * which is risky if data already uses the 'WHATSAPP' value.
     * Most developers leave 'down' empty for ENUM value additions.
     */
  }
};