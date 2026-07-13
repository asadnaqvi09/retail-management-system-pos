const cron = require('node-cron');
const logger = require('../config/logger');
const backupModel = require('../modules/backup/backup.model');

let schedulerStarted = false;

function getCurrentTimeLabel() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

async function runAutomaticBackups() {
  const currentTime = getCurrentTimeLabel();
  const stores = await backupModel.listStoresDueForAutomaticBackup(currentTime);
  for (const store of stores) {
    try {
      const alreadyRan = await backupModel.hasAutomaticBackupToday(store.store_id);
      if (alreadyRan) {
        continue;
      }
      await backupModel.runBackup(store.store_id, 'automatic');
      logger.info(`Automatic backup completed for store ${store.store_id}`);
    } catch (error) {
      logger.error(`Automatic backup failed for store ${store.store_id}: ${error.message}`);
    }
  }
}

function startBackupScheduler() {
  if (schedulerStarted || process.env.BACKUP_SCHEDULER_ENABLED === 'false') {
    return;
  }
  schedulerStarted = true;
  cron.schedule('* * * * *', () => {
    runAutomaticBackups().catch((error) => {
      logger.error(`Backup scheduler error: ${error.message}`);
    });
  });
  logger.info('Backup scheduler started');
}

module.exports = {
  startBackupScheduler,
  runAutomaticBackups,
};
