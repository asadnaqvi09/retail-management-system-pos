const cloudinary = require('cloudinary').v2;
const AppError = require('../utils/AppError');

function ensureCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError('Cloudinary is not configured', 500);
  }
  return { cloudName, apiKey, apiSecret };
}

function getCloudinaryClient() {
  const config = ensureCloudinaryConfig();
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  return cloudinary;
}

module.exports = {
  getCloudinaryClient,
  ensureCloudinaryConfig,
};
