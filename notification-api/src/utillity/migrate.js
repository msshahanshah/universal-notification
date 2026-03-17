const logger = require('../logger');
const { messageLogs } = require('../logs-api/controller');
const { migrateAllDatabases } = require('./migrationRunner');

(async () => {
    try {
        await migrateAllDatabases();
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', {
            message: error.message,
            stack: error?.stack
        });
        process.exit(1);
    }
})();
