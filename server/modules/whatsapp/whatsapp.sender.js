const logger = require('../../config/logger');
const AppError = require('../../utils/AppError');
const {
  isTwilioConfigured,
  ensureTwilioConfig,
  getTwilioClient,
  normalizeWhatsappRecipient,
} = require('../../config/twilio');

async function sendWhatsappMessage(phoneNumber, body) {
  const to = normalizeWhatsappRecipient(phoneNumber);
  const dryRun = process.env.WHATSAPP_DRY_RUN === 'true';

  if (!isTwilioConfigured()) {
    if (dryRun) {
      logger.info(`[WhatsApp dry-run] To: ${to}\n${body}`);
      return {
        sid: `dry-run-${Date.now()}`,
        dryRun: true,
      };
    }
    throw new AppError('Twilio WhatsApp is not configured. Set TWILIO_* env vars or WHATSAPP_DRY_RUN=true', 500);
  }

  const config = ensureTwilioConfig();
  const client = getTwilioClient();
  const message = await client.messages.create({
    from: config.from.startsWith('whatsapp:') ? config.from : `whatsapp:${config.from}`,
    to,
    body,
  });

  return {
    sid: message.sid,
    dryRun: false,
  };
}

module.exports = {
  sendWhatsappMessage,
};
