const { Pool } = require('pg');
const logger = require('./logger');

let pool = null;

function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required in .env');
  }
  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 10000,
  };
}

function mapDatabaseError(error) {
  const mapped = new Error(error.message);
  mapped.name = 'DatabaseError';
  mapped.code = error.code;
  mapped.detail = error.detail;
  mapped.constraint = error.constraint;
  mapped.table = error.table;
  mapped.column = error.column;
  mapped.stack = error.stack;
  return mapped;
}

function getPool() {
  if (!pool) {
    pool = new Pool(getDatabaseConfig());
    pool.on('error', (error) => {
      logger.error(`Unexpected PostgreSQL pool error: ${error.message}`, { code: error.code });
    });
  }
  return pool;
}

async function connectDatabase() {
  const activePool = getPool();
  try {
    const result = await activePool.query('SELECT NOW() AS connected_at, current_database() AS database_name');
    const { connected_at: connectedAt, database_name: databaseName } = result.rows[0];
    logger.info(`PostgreSQL connected: ${databaseName} at ${connectedAt}`);
    return activePool;
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL', {
      provider: 'supabase',
      code: error.code,
      message: error.message,
    });
    if (error.code === '3D000') {
      throw new Error('Database does not exist. Check your Supabase DATABASE_URL.');
    }
    if (error.code === '28P01') {
      throw new Error('PostgreSQL authentication failed. Check DATABASE_URL password in .env');
    }
    if (error.code === 'ECONNREFUSED') {
      throw new Error('PostgreSQL connection refused. Check DATABASE_URL host and port.');
    }
    throw mapDatabaseError(error);
  }
}

async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 500) {
      logger.warn(`Slow query (${duration}ms): ${text.split('\n')[0]}`);
    }
    return result;
  } catch (error) {
    logger.error('Database query failed', {
      code: error.code,
      message: error.message,
      detail: error.detail,
      query: text.split('\n')[0],
    });
    throw mapDatabaseError(error);
  }
}

async function getClient() {
  try {
    return await getPool().connect();
  } catch (error) {
    logger.error('Failed to acquire PostgreSQL client', {
      code: error.code,
      message: error.message,
    });
    throw mapDatabaseError(error);
  }
}

async function closeDatabase() {
  if (!pool) {
    return;
  }

  try {
    await pool.end();
    logger.info('PostgreSQL pool closed');
  } catch (error) {
    logger.error('Failed to close PostgreSQL pool', { message: error.message });
    throw mapDatabaseError(error);
  } finally {
    pool = null;
  }
}

module.exports = {
  getPool,
  connectDatabase,
  query,
  getClient,
  closeDatabase,
  mapDatabaseError,
};
