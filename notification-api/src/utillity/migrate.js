const { migrateAllDatabases } = require('./migrationRunner');

(async () => {
    try {
        await migrateAllDatabases();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
})();