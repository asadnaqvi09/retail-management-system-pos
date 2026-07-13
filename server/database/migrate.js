require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { connectDatabase, getClient, closeDatabase } = require('../config/database');
const logger = require('../config/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(result.rows.map((row) => row.filename));
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function runMigrationFile(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  logger.info(`Applying migration: ${filename}`);
  await client.query('BEGIN');

  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    logger.info(`Migration applied: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function seedPasswordRecovery(client) {
  const existing = await client.query('SELECT COUNT(*)::INT AS count FROM password_recovery_codes');
  if (existing.rows[0].count > 0) {
    logger.info('Password recovery already configured — skipping');
    return;
  }
  const storeResult = await client.query('SELECT id FROM stores ORDER BY created_at ASC LIMIT 1');
  if (!storeResult.rows[0]) {
    return;
  }
  const recoveryHash = await bcrypt.hash('ZYRO-RECOVERY-2026', 10);
  await client.query(
    `INSERT INTO password_recovery_codes (store_id, recovery_code_hash)
     VALUES ($1, $2)`,
    [storeResult.rows[0].id, recoveryHash]
  );
  logger.info('Default password recovery code seeded');
}

async function seedDefaultUsers(client) {
  const existingUsers = await client.query('SELECT COUNT(*)::INT AS count FROM users');
  if (existingUsers.rows[0].count > 0) {
    logger.info('Default users already exist — skipping user seed');
    return;
  }

  const storeResult = await client.query('SELECT id FROM stores ORDER BY created_at ASC LIMIT 1');
  const adminRoleResult = await client.query(
    `SELECT r.id
     FROM roles r
     JOIN stores s ON s.id = r.store_id
     WHERE r.name = 'Admin'
     ORDER BY s.created_at ASC
     LIMIT 1`
  );
  const cashierRoleResult = await client.query(
    `SELECT r.id
     FROM roles r
     JOIN stores s ON s.id = r.store_id
     WHERE r.name = 'Cashier'
     ORDER BY s.created_at ASC
     LIMIT 1`
  );

  if (!storeResult.rows[0] || !adminRoleResult.rows[0] || !cashierRoleResult.rows[0]) {
    throw new Error('Seed data missing store/roles. Ensure 002_default_seed.sql ran successfully.');
  }

  const storeId = storeResult.rows[0].id;
  const adminRoleId = adminRoleResult.rows[0].id;
  const cashierRoleId = cashierRoleResult.rows[0].id;

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const cashierPinHash = await bcrypt.hash('1234', 10);

  await client.query('BEGIN');

  try {
    await client.query(
      `INSERT INTO users (
        store_id, role_id, name, username, email, password_hash, pin_hash, default_landing_screen
      ) VALUES ($1, $2, $3, $4, $5, $6, NULL, 'dashboard')`,
      [storeId, adminRoleId, 'Store Admin', 'admin', 'admin@zyrofashion.pk', adminPasswordHash]
    );

    await client.query(
      `INSERT INTO users (
        store_id, role_id, name, username, password_hash, pin_hash, default_landing_screen
      ) VALUES ($1, $2, $3, $4, NULL, $5, 'pos')`,
      [storeId, cashierRoleId, 'Fatima Riaz', 'fatima', cashierPinHash]
    );

    await client.query('COMMIT');
    logger.info('Default users seeded: admin / admin123, fatima / PIN 1234');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function migrate() {
  await connectDatabase();
  const client = await getClient();

  try {
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = getMigrationFiles();
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      logger.info('No pending SQL migrations');
    }

    for (const file of pending) {
      await runMigrationFile(client, file);
    }

    await seedDefaultUsers(client);
    await seedPasswordRecovery(client);
    logger.info(`Migration complete. Applied ${pending.length} SQL migration(s).`);
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`, { code: error.code, detail: error.detail });
    process.exitCode = 1;
  } finally {
    client.release();
    await closeDatabase();
  }
}

migrate();
