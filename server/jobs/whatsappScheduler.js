const dayjs = require('dayjs');
const cron = require('node-cron');
const logger = require('../config/logger');
const whatsappModel = require('../modules/whatsapp/whatsapp.model');

let schedulerStarted = false;

function getCurrentTimeLabel() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

async function runAutomaticWhatsappSummaries() {
  const currentTime = getCurrentTimeLabel();
  const summaryDate = dayjs().format('YYYY-MM-DD');
  const stores = await whatsappModel.listStoresDueForSummary(currentTime);

  for (const store of stores) {
    try {
      const settings = await whatsappModel.loadWhatsappSettings(store.store_id);
      const phoneNumber = settings.phoneNumber || '';
      if (!phoneNumber) {
        continue;
      }
      const alreadySent = await whatsappModel.hasSummarySentToday(
        store.store_id,
        summaryDate,
        phoneNumber
      );
      if (alreadySent) {
        continue;
      }
      await whatsappModel.sendDailySummary(store.store_id, {
        summaryDate,
        recipientPhone: phoneNumber,
        force: false,
        throwOnError: false,
      });
      logger.info(`WhatsApp daily summary sent for store ${store.store_id}`);
    } catch (error) {
      logger.error(`WhatsApp summary failed for store ${store.store_id}: ${error.message}`);
    }
  }
}

function startWhatsappScheduler() {
  if (schedulerStarted || process.env.WHATSAPP_SCHEDULER_ENABLED === 'false') {
    return;
  }
  schedulerStarted = true;
  cron.schedule('* * * * *', () => {
    runAutomaticWhatsappSummaries().catch((error) => {
      logger.error(`WhatsApp scheduler error: ${error.message}`);
    });
  });
  logger.info('WhatsApp summary scheduler started');
}

module.exports = {
  startWhatsappScheduler,
  runAutomaticWhatsappSummaries,
};
