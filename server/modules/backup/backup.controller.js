const backupModel = require('./backup.model');

async function listBackups(req, res, next) {
  try {
    const data = await backupModel.listBackups(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function createBackup(req, res, next) {
  try {
    const data = await backupModel.createManualBackup(req.user.storeId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function downloadBackup(req, res, next) {
  try {
    const file = await backupModel.getBackupDownload(req.user.storeId, req.params.id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  } catch (error) {
    next(error);
  }
}

async function deleteBackup(req, res, next) {
  try {
    const data = await backupModel.deleteBackup(req.user.storeId, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function restoreBackup(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Backup file is required' });
    }
    const data = await backupModel.restoreBackup(req.user.storeId, req.file.buffer);
    res.json({
      success: true,
      data: {
        ...data,
        message: 'Backup restored successfully. All active sessions were revoked.',
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listBackups,
  createBackup,
  downloadBackup,
  deleteBackup,
  restoreBackup,
};
