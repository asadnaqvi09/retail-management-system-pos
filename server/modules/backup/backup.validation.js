const Joi = require('joi');

const listBackupsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const restoreBackupSchema = Joi.object({
  confirmRestore: Joi.string().valid('RESTORE').required(),
});

module.exports = {
  listBackupsQuerySchema,
  restoreBackupSchema,
};
