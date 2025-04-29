const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config');

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

async function runMigrations(sequelize, clientId = 'common') {
    const Umzug = require('umzug');
    const umzug = new Umzug({
        migrations: {
            path: path.join(__dirname, '../../migrations'),
            params: [sequelize.getQueryInterface(), Sequelize]
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
    // First, migrate the common database
    const commonConfig = {
        dialect: 'postgres',
        host: config.dbHost || 'localhost',
        port: config.dbPort || 5432,
        database: config.dbName || 'notifications_db',
        username: config.dbUser || 'postgres',
        password: config.dbPassword || 'admin'
    };

    try {
        // Migrate common database
        console.log('Migrating common database...');
        const commonSequelize = new Sequelize(commonConfig);
        await runMigrations(commonSequelize, 'common');
        await commonSequelize.close();

        // Load and migrate client databases
        const clients = await loadClientConfigs();
        for (const client of clients) {
            if (!client.DBCONFIG) {
                console.log(`Client ${client.ID} uses common database - skipping`);
                continue;
            }

            const clientConfig = {
                dialect: 'postgres',
                host: client.DBCONFIG.HOST,
                port: client.DBCONFIG.PORT,
                database: client.DBCONFIG.NAME,
                username: client.DBCONFIG.USER,
                password: client.DBCONFIG.PASSWORD
            };

            const clientSequelize = new Sequelize(clientConfig);
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