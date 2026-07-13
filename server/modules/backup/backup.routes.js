const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { validateBody, validateQuery } = require('../../middleware/validate.middleware');
const { backupFileUpload, handleMulterError } = require('../../middleware/upload.middleware');
const { listBackupsQuerySchema, restoreBackupSchema } = require('./backup.validation');
const backupController = require('./backup.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('backup.manage'),
  validateQuery(listBackupsQuerySchema),
  backupController.listBackups
);

router.post(
  '/',
  requirePermission('backup.manage'),
  backupController.createBackup
);

router.post(
  '/restore',
  requirePermission('backup.manage'),
  backupFileUpload.single('backup'),
  handleMulterError,
  validateBody(restoreBackupSchema),
  backupController.restoreBackup
);

router.get(
  '/:id/download',
  requirePermission('backup.manage'),
  backupController.downloadBackup
);

router.delete(
  '/:id',
  requirePermission('backup.manage'),
  backupController.deleteBackup
);

module.exports = router;
