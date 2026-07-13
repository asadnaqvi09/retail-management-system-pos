const whatsappModel = require('./whatsapp.model');

async function listSummaries(req, res, next) {
  try {
    const data = await whatsappModel.listSummaries(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getSummary(req, res, next) {
  try {
    const row = await whatsappModel.findSummaryRecord(req.params.id, req.user.storeId);
    res.json({
      success: true,
      data: {
        id: row.id,
        storeId: row.store_id,
        summaryDate: row.summary_date,
        recipientPhone: row.recipient_phone,
        payload: row.payload_json || {},
        status: row.status,
        errorMessage: row.error_message || null,
        sentAt: row.sent_at,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function previewSummary(req, res, next) {
  try {
    const data = await whatsappModel.previewDailySummary(
      req.user.storeId,
      req.query.summaryDate
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function sendSummary(req, res, next) {
  try {
    const data = await whatsappModel.sendDailySummary(req.user.storeId, {
      summaryDate: req.body.summaryDate,
      recipientPhone: req.body.recipientPhone,
      force: req.body.force,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function sendTestMessage(req, res, next) {
  try {
    const data = await whatsappModel.sendTestMessage(req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listSummaries,
  getSummary,
  previewSummary,
  sendSummary,
  sendTestMessage,
};
