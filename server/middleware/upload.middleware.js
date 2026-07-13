const multer = require('multer');
const AppError = require('../utils/AppError');

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter(req, file, callback) {
    if (!imageMimeTypes.has(file.mimetype)) {
      callback(new AppError('Only JPEG, PNG, and WebP images are allowed', 400));
      return;
    }
    callback(null, true);
  },
});

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!imageMimeTypes.has(file.mimetype)) {
      callback(new AppError('Only JPEG, PNG, and WebP images are allowed', 400));
      return;
    }
    callback(null, true);
  },
});

const importFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const allowed = new Set([
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const extensionAllowed = extension === 'csv' || extension === 'xlsx';
    if (!allowed.has(file.mimetype) && !extensionAllowed) {
      callback(new AppError('Only CSV and XLSX files are allowed', 400));
      return;
    }
    callback(null, true);
  },
});

function handleMulterError(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Uploaded file is too large', 400));
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files uploaded', 400));
    }
    return next(new AppError(error.message, 400));
  }
  next(error);
}

const backupFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const allowed = new Set(['application/json', 'text/plain', 'application/octet-stream']);
    if (!allowed.has(file.mimetype) && extension !== 'json') {
      callback(new AppError('Only JSON backup files are allowed', 400));
      return;
    }
    callback(null, true);
  },
});

module.exports = {
  productImageUpload,
  receiptUpload,
  importFileUpload,
  backupFileUpload,
  handleMulterError,
};
