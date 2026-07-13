const barcodesModel = require('./barcodes.model');

async function getVariantLabel(req, res, next) {
  try {
    const data = await barcodesModel.getVariantLabel(req.user.storeId, req.params.variantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function downloadVariantLabelPdf(req, res, next) {
  try {
    const result = await barcodesModel.generateVariantLabelsPdf(
      req.user.storeId,
      req.user.id,
      req.params.variantId,
      req.query.template,
      req.query.copies
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    res.setHeader('X-Label-Template', result.template);
    res.setHeader('X-Label-Count', String(result.labelCount));
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
}

async function downloadBulkLabelsPdf(req, res, next) {
  try {
    const result = await barcodesModel.generateBulkLabelsPdf(
      req.user.storeId,
      req.user.id,
      req.body
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    res.setHeader('X-Label-Template', result.template);
    res.setHeader('X-Label-Count', String(result.labelCount));
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVariantLabel,
  downloadVariantLabelPdf,
  downloadBulkLabelsPdf,
};
