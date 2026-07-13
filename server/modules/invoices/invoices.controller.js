const invoicesModel = require('./invoices.model');

async function getInvoicePayload(req, res, next) {
  try {
    const data = await invoicesModel.buildInvoicePayload(req.user.storeId, req.params.saleId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function downloadInvoicePdf(req, res, next) {
  try {
    const format = req.query.format || 'thermal';
    const result = await invoicesModel.generateInvoicePdf(
      req.user.storeId,
      req.params.saleId,
      format
    );
    await invoicesModel.createPrintLog(req.params.saleId, req.user.storeId, format, 'queued');
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    res.setHeader('X-Invoice-Number', result.invoiceNumber);
    res.setHeader('X-Invoice-Format', result.format);
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
}

async function createPrintLog(req, res, next) {
  try {
    const data = await invoicesModel.createPrintLog(
      req.params.saleId,
      req.user.storeId,
      req.body.format,
      req.body.status,
      req.body.errorMessage || null
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listPrintLogs(req, res, next) {
  try {
    const data = await invoicesModel.listPrintLogs(req.params.saleId, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInvoicePayload,
  downloadInvoicePdf,
  createPrintLog,
  listPrintLogs,
};
