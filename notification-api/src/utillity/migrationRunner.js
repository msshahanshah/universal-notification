const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const Umzug = require('umzug');

async function loadClientConfigs() {
    try {
        const clientListPath = path.join(__dirname, '../../../clientList.json');
        console.log('Loading client configurations from:', clientListPath);
        const clientData = await fs.readFile(clientListPath, 'utf-8');
        return JSON.parse(clientData);
    } catch (error) {
        console.error('Failed to load client configurations:', error);
        throw error;
    }
}

async function runMigrations(sequelize, clientId) {
    // Ensure schema exists
    const schemaName = clientId.toLowerCase()
    await sequelize.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    const umzug = new Umzug({
        migrations: {
            path: path.join(__dirname, '../../migrations'),
            params: [sequelize.getQueryInterface(), Sequelize, schemaName]
        },
        storage: 'sequelize',
        storageOptions: {
            sequelize: sequelize
        }
    });
    try {
        console.log(`Running migrations for client: ${clientId}`);
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
            const clientConfig = {
                dialect: 'postgres',
                host: client?.DBCONFIG?.HOST,
                port: client?.DBCONFIG?.PORT,
                database: client?.DBCONFIG?.NAME,
                username: client?.DBCONFIG?.USER,
                password: client?.DBCONFIG?.PASSWORD,
                dialectOptions: {
                    options: `-c search_path=${client.ID.toLowerCase()},public`
                },
            };
            const clientSequelize = new Sequelize(clientConfig);

            clientSequelize.authenticate()
            await runMigrations(clientSequelize, client.ID);
            await clientSequelize.close();
        }
        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Migration process failed:', error);
        process.exit(1);
    }

}

module.exports = { migrateAllDatabases };