const path = require('path');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { connectDatabase, closeDatabase } = require('./config/database');
const logger = require('./config/logger');
const { apiLimiter } = require('./middleware/rateLimit.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ exposedHeaders: ['X-Invoice-Number', 'X-Invoice-Format'] }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const registerRoutes = require('./routes');

app.get('/health', async (req, res, next) => {
  try {
    const { query } = require('./config/database');
    const dbCheck = await query('SELECT NOW() AS db_time');

    res.json({
      success: true,
      data: {
        service: 'zyro-rms-server',
        status: 'ok',
        database: 'connected',
        dbTime: dbCheck.rows[0].db_time,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/v1', apiLimiter);
registerRoutes(app);

app.use('/api/v1', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  logger.error(err.message, {
    code: err.code,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.status || 500;
  const response = {
    success: false,
    error: err.message || 'Internal server error',
  };

  if (process.env.NODE_ENV === 'development' && err.code) {
    response.code = err.code;
  }

  res.status(statusCode).json(response);
});

async function startServer() {
  try {
    await connectDatabase();

    const server = app.listen(PORT, () => {
      logger.info(`Zyro RMS API running on http://localhost:${PORT}`);
    });

    const { startBackupScheduler } = require('./jobs/backupScheduler');
    startBackupScheduler();

    const { startWhatsappScheduler } = require('./jobs/whatsappScheduler');
    startWhatsappScheduler();

    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down`);
      server.close(async () => {
        await closeDatabase();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  }
}

startServer();
