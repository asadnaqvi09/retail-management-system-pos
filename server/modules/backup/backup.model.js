const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const {
  exportStoreSnapshot,
  restoreStoreSnapshot,
  writeSnapshotFile,
  readSnapshotFile,
  removeSnapshotFile,
  validateSnapshot,
} = require('./backup.snapshot');

function mapBackupRow(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    filePath: row.file_path,
    backupType: row.backup_type,
    status: row.status,
    sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
    errorMessage: row.error_message || null,
    createdAt: row.created_at,
  };
}

function formatBackupFilename(backup) {
  const date = new Date(backup.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `zyro-backup-${date}-${backup.id.slice(0, 8)}.json`;
}

async function listBackups(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM backups
     WHERE store_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [storeId, limit, offset]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapBackupRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function findBackupRecord(backupId, storeId) {
  const result = await query(
    `SELECT *
     FROM backups
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [backupId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Backup not found', 404);
  }
  return result.rows[0];
}

async function loadBackupSettings(storeId) {
  const result = await query(
    `SELECT values
     FROM store_settings
     WHERE store_id = $1 AND section = 'backup'
     LIMIT 1`,
    [storeId]
  );
  const values = result.rows[0]?.values || {};
  return {
    autoBackupEnabled: Boolean(values.autoBackupEnabled),
    backupTime: values.backupTime || '23:00',
    retentionDays: Number(values.retentionDays || 30),
  };
}

async function createBackupRecord(storeId, payload) {
  const result = await query(
    `INSERT INTO backups (
      id,
      store_id,
      file_path,
      backup_type,
      status,
      size_bytes,
      error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      payload.id,
      storeId,
      payload.filePath,
      payload.backupType,
      payload.status,
      payload.sizeBytes ?? null,
      payload.errorMessage ?? null,
    ]
  );
  return mapBackupRow(result.rows[0]);
}

async function updateBackupRecord(backupId, storeId, payload) {
  const fields = [];
  const values = [];
  let index = 1;
  if (payload.status !== undefined) {
    fields.push(`status = $${index}`);
    values.push(payload.status);
    index += 1;
  }
  if (payload.sizeBytes !== undefined) {
    fields.push(`size_bytes = $${index}`);
    values.push(payload.sizeBytes);
    index += 1;
  }
  if (payload.errorMessage !== undefined) {
    fields.push(`error_message = $${index}`);
    values.push(payload.errorMessage);
    index += 1;
  }
  if (payload.filePath !== undefined) {
    fields.push(`file_path = $${index}`);
    values.push(payload.filePath);
    index += 1;
  }
  if (fields.length === 0) {
    return findBackupRecord(backupId, storeId).then(mapBackupRow);
  }
  values.push(backupId, storeId);
  const result = await query(
    `UPDATE backups
     SET ${fields.join(', ')}
     WHERE id = $${index} AND store_id = $${index + 1}
     RETURNING *`,
    values
  );
  return mapBackupRow(result.rows[0]);
}

async function cleanupExpiredBackups(storeId, retentionDays) {
  const days = Math.max(Number(retentionDays) || 30, 1);
  const expired = await query(
    `SELECT id, file_path
     FROM backups
     WHERE store_id = $1
       AND created_at < NOW() - ($2::text || ' days')::interval
     ORDER BY created_at ASC`,
    [storeId, String(days)]
  );
  for (const row of expired.rows) {
    try {
      await removeSnapshotFile(row.file_path);
    } catch (error) {
      // File may already be missing.
    }
    await query(`DELETE FROM backups WHERE id = $1`, [row.id]);
  }
  return { removed: expired.rows.length };
}

async function runBackup(storeId, backupType = 'manual') {
  const backupId = uuidv4();
  let record = await createBackupRecord(storeId, {
    id: backupId,
    filePath: '',
    backupType,
    status: 'failed',
    errorMessage: 'Backup did not complete',
  });

  try {
    const snapshot = await exportStoreSnapshot(storeId);
    const file = await writeSnapshotFile(storeId, snapshot, backupId);
    record = await updateBackupRecord(backupId, storeId, {
      status: 'success',
      filePath: file.relativePath,
      sizeBytes: file.sizeBytes,
      errorMessage: null,
    });
    const settings = await loadBackupSettings(storeId);
    await cleanupExpiredBackups(storeId, settings.retentionDays);
    return record;
  } catch (error) {
    await updateBackupRecord(backupId, storeId, {
      status: 'failed',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function createManualBackup(storeId) {
  return runBackup(storeId, 'manual');
}

async function getBackupDownload(storeId, backupId) {
  const backup = await findBackupRecord(backupId, storeId);
  if (backup.status !== 'success') {
    throw new AppError('Only successful backups can be downloaded', 400);
  }
  const snapshot = await readSnapshotFile(backup.file_path);
  const content = JSON.stringify(snapshot, null, 2);
  return {
    backup: mapBackupRow(backup),
    buffer: Buffer.from(content, 'utf8'),
    filename: formatBackupFilename(mapBackupRow(backup)),
    contentType: 'application/json',
  };
}

async function deleteBackup(storeId, backupId) {
  const backup = await findBackupRecord(backupId, storeId);
  try {
    if (backup.file_path) {
      await removeSnapshotFile(backup.file_path);
    }
  } catch (error) {
    // Ignore missing files.
  }
  await query(`DELETE FROM backups WHERE id = $1 AND store_id = $2`, [backupId, storeId]);
  return { id: backupId, deleted: true };
}

async function restoreBackup(storeId, fileBuffer) {
  let snapshot;
  try {
    snapshot = JSON.parse(fileBuffer.toString('utf8'));
  } catch (error) {
    throw new AppError('Backup file must be valid JSON', 400);
  }
  validateSnapshot(snapshot, storeId);
  const result = await restoreStoreSnapshot(storeId, snapshot);
  await query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE user_id IN (SELECT id FROM users WHERE store_id = $1)
       AND revoked_at IS NULL`,
    [storeId]
  );
  return result;
}

async function listStoresDueForAutomaticBackup(currentTime) {
  const [hour, minute] = currentTime.split(':');
  const result = await query(
    `SELECT s.id AS store_id, ss.values
     FROM stores s
     JOIN store_settings ss ON ss.store_id = s.id AND ss.section = 'backup'
     WHERE COALESCE((ss.values->>'autoBackupEnabled')::boolean, FALSE) = TRUE
       AND COALESCE(ss.values->>'backupTime', '23:00') = $1`,
    [`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`]
  );
  return result.rows;
}

async function hasAutomaticBackupToday(storeId) {
  const result = await query(
    `SELECT id
     FROM backups
     WHERE store_id = $1
       AND backup_type = 'automatic'
       AND status = 'success'
       AND created_at::date = CURRENT_DATE
     LIMIT 1`,
    [storeId]
  );
  return Boolean(result.rows[0]);
}

module.exports = {
  listBackups,
  createManualBackup,
  getBackupDownload,
  deleteBackup,
  restoreBackup,
  runBackup,
  loadBackupSettings,
  listStoresDueForAutomaticBackup,
  hasAutomaticBackupToday,
  formatBackupFilename,
};
