const twilio = require('twilio');
const AppError = require('../utils/AppError');

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
}

function ensureTwilioConfig() {
  if (!isTwilioConfigured()) {
    throw new AppError('Twilio WhatsApp is not configured', 500);
  }
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_FROM,
  };
}

function getTwilioClient() {
  const config = ensureTwilioConfig();
  return twilio(config.accountSid, config.authToken);
}

function normalizeWhatsappRecipient(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/[^\d+]/g, '');
  if (!digits) {
    throw new AppError('Recipient phone number is required', 400);
  }
  let normalized = digits;
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      normalized = `+92${normalized.slice(1)}`;
    } else if (normalized.startsWith('92')) {
      normalized = `+${normalized}`;
    } else {
      normalized = `+${normalized}`;
    }
  }
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new AppError('Invalid recipient phone number', 400);
  }
  return normalized.startsWith('whatsapp:') ? normalized : `whatsapp:${normalized}`;
}

module.exports = {
  isTwilioConfigured,
  ensureTwilioConfig,
  getTwilioClient,
  normalizeWhatsappRecipient,
};
