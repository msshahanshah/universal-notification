const { Sequelize } = require("sequelize");
const path = require("path");
const Umzug = require("umzug");
const { loadClientConfigs } = require("./loadClientConfigs");

async function runMigrations(sequelize, clientId) {
  // Ensure schema exists
  const schemaName = clientId.toLowerCase();

  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
  console.log("path >>", path.join(__dirname, "../../migrations"));

  const MigrationMeta = sequelize.define(
    "SequelizeMeta",
    { name: { type: Sequelize.STRING, allowNull: false, primaryKey: true } },
    { tableName: "SequelizeMeta", schema: schemaName, timestamps: false },
  );
  const umzug = new Umzug({
    migrations: {
      path: path.join(__dirname, "../../migrations"),
      params: [sequelize.getQueryInterface(), Sequelize, schemaName],
    },
    storage: "sequelize",
    storageOptions: { sequelize: sequelize, model: MigrationMeta },
  });

  try {
    console.log(`Running migrations for client: ${clientId}`);
    const pending = await umzug.pending();
    console.log(
      `Pending migrations for ${clientId}:`,
      pending.map((m) => m.file),
    );
    if (pending.length === 0) {
      console.log(
        `No pending migrations found for ${clientId}. Check your SequelizeMeta table!`,
      );
    }
    await umzug.up();
    console.log(`Migrations completed for client: ${clientId}`);
  } catch (error) {
    console.error(`Migration failed for client ${clientId}:`, error);
    throw error;
  }
}

async function migrateAllDatabases() {
  try {
    // Load and migrate client databases
    const clients = await loadClientConfigs();
    for (const client of clients) {
      console.log(client)
      const clientConfig = {
        dialect: "postgres",
        host: client?.DBCONFIG?.HOST,
        port: client?.DBCONFIG?.PORT,
        database: client?.DBCONFIG?.NAME,
        username: client?.DBCONFIG?.USER,
        password: client?.DBCONFIG?.PASSWORD,
        dialectOptions: {
          options: `-c search_path=${client.ID.toLowerCase()},public`,
        },
      };
      const clientSequelize = new Sequelize(clientConfig);

      await clientSequelize.authenticate();
      const schemaName = client.ID.toLowerCase();
      await clientSequelize.query(`SET search_path TO ${schemaName}, public`);

      await runMigrations(clientSequelize, client.ID);
      await clientSequelize.close();
    }
    console.log("All migrations completed successfully");
  } catch (error) {
    console.error("Migration process failed:", error);
    process.exit(1);
  }
}

module.exports = { migrateAllDatabases };
