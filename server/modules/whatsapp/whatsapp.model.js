const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { buildDailyDigest } = require('./whatsapp.digest');
const { sendWhatsappMessage } = require('./whatsapp.sender');

const DEFAULT_WHATSAPP_SETTINGS = {
  enabled: false,
  phoneNumber: '',
  sendTime: '21:00',
  includeLowStock: true,
  includeTopProducts: true,
  ownerName: '',
};

function mapSummaryRow(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    summaryDate: row.summary_date,
    recipientPhone: row.recipient_phone,
    payload: row.payload_json || {},
    status: row.status,
    errorMessage: row.error_message || null,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function mergeWhatsappSettings(values) {
  return {
    ...DEFAULT_WHATSAPP_SETTINGS,
    ...(values && typeof values === 'object' ? values : {}),
  };
}

async function loadWhatsappSettings(storeId) {
  const result = await query(
    `SELECT values
     FROM store_settings
     WHERE store_id = $1 AND section = 'whatsapp'
     LIMIT 1`,
    [storeId]
  );
  return mergeWhatsappSettings(result.rows[0]?.values || {});
}

async function listSummaries(storeId, filters) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM whatsapp_summaries
     WHERE store_id = $1
       AND ($2::text IS NULL OR status::text = $2)
       AND ($3::date IS NULL OR summary_date >= $3::date)
       AND ($4::date IS NULL OR summary_date <= $4::date)
     ORDER BY summary_date DESC, created_at DESC
     LIMIT $5 OFFSET $6`,
    [
      storeId,
      filters.status || null,
      filters.dateFrom || null,
      filters.dateTo || null,
      limit,
      offset,
    ]
  );
  const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
  return {
    items: result.rows.map(mapSummaryRow),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function findSummaryRecord(summaryId, storeId) {
  const result = await query(
    `SELECT *
     FROM whatsapp_summaries
     WHERE id = $1 AND store_id = $2
     LIMIT 1`,
    [summaryId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('WhatsApp summary not found', 404);
  }
  return result.rows[0];
}

async function previewDailySummary(storeId, summaryDate) {
  const settings = await loadWhatsappSettings(storeId);
  const digest = await buildDailyDigest(storeId, summaryDate, settings);
  return {
    settings,
    digest,
    twilioConfigured: require('../../config/twilio').isTwilioConfigured(),
    dryRunEnabled: process.env.WHATSAPP_DRY_RUN === 'true',
  };
}

async function upsertSummaryRecord(storeId, payload) {
  const result = await query(
    `INSERT INTO whatsapp_summaries (
      id,
      store_id,
      summary_date,
      recipient_phone,
      payload_json,
      status,
      error_message,
      sent_at
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
    ON CONFLICT (store_id, summary_date, recipient_phone)
    DO UPDATE SET
      payload_json = EXCLUDED.payload_json,
      status = EXCLUDED.status,
      error_message = EXCLUDED.error_message,
      sent_at = EXCLUDED.sent_at
    RETURNING *`,
    [
      payload.id || uuidv4(),
      storeId,
      payload.summaryDate,
      payload.recipientPhone,
      JSON.stringify(payload.payloadJson || {}),
      payload.status,
      payload.errorMessage || null,
      payload.sentAt || null,
    ]
  );
  return mapSummaryRow(result.rows[0]);
}

async function sendDailySummary(storeId, options = {}) {
  const settings = await loadWhatsappSettings(storeId);
  if (!settings.enabled && !options.force) {
    throw new AppError('WhatsApp daily summary is disabled in settings', 400);
  }

  const summaryDate = options.summaryDate || dayjs().format('YYYY-MM-DD');
  const recipientPhone = (options.recipientPhone || settings.phoneNumber || '').trim();
  if (!recipientPhone) {
    throw new AppError('Recipient phone number is not configured', 400);
  }

  const existing = await query(
    `SELECT id, status
     FROM whatsapp_summaries
     WHERE store_id = $1
       AND summary_date = $2
       AND recipient_phone = $3
     LIMIT 1`,
    [storeId, summaryDate, recipientPhone]
  );
  if (existing.rows[0]?.status === 'sent' && !options.force) {
    throw new AppError('Summary for this date was already sent', 409);
  }

  const digest = await buildDailyDigest(storeId, summaryDate, settings);
  const recordId = existing.rows[0]?.id || uuidv4();

  try {
    const sendResult = await sendWhatsappMessage(recipientPhone, digest.message);
    return upsertSummaryRecord(storeId, {
      id: recordId,
      summaryDate,
      recipientPhone,
      payloadJson: {
        ...digest,
        delivery: sendResult,
      },
      status: 'sent',
      sentAt: new Date().toISOString(),
      errorMessage: null,
    });
  } catch (error) {
    const failed = await upsertSummaryRecord(storeId, {
      id: recordId,
      summaryDate,
      recipientPhone,
      payloadJson: digest,
      status: 'failed',
      errorMessage: error.message,
      sentAt: null,
    });
    if (options.throwOnError !== false) {
      throw error;
    }
    return failed;
  }
}

async function sendTestMessage(storeId, payload) {
  const settings = await loadWhatsappSettings(storeId);
  const recipientPhone = (payload.recipientPhone || settings.phoneNumber || '').trim();
  if (!recipientPhone) {
    throw new AppError('Recipient phone number is required', 400);
  }
  const message =
    payload.message?.trim() ||
    `✅ Zyro RMS test message\nStore: ${(await previewDailySummary(storeId)).digest.store.name}\nTime: ${new Date().toLocaleString()}`;
  const sendResult = await sendWhatsappMessage(recipientPhone, message);
  return {
    recipientPhone,
    message,
    delivery: sendResult,
  };
}

async function listStoresDueForSummary(currentTime) {
  const result = await query(
    `SELECT s.id AS store_id, ss.values
     FROM stores s
     JOIN store_settings ss ON ss.store_id = s.id AND ss.section = 'whatsapp'
     WHERE COALESCE((ss.values->>'enabled')::boolean, FALSE) = TRUE
       AND COALESCE(NULLIF(ss.values->>'phoneNumber', ''), '') <> ''
       AND COALESCE(ss.values->>'sendTime', '21:00') = $1`,
    [currentTime]
  );
  return result.rows;
}

async function hasSummarySentToday(storeId, summaryDate, recipientPhone) {
  const result = await query(
    `SELECT id
     FROM whatsapp_summaries
     WHERE store_id = $1
       AND summary_date = $2
       AND recipient_phone = $3
       AND status = 'sent'
     LIMIT 1`,
    [storeId, summaryDate, recipientPhone]
  );
  return Boolean(result.rows[0]);
}

module.exports = {
  loadWhatsappSettings,
  listSummaries,
  findSummaryRecord,
  previewDailySummary,
  sendDailySummary,
  sendTestMessage,
  listStoresDueForSummary,
  hasSummarySentToday,
};
