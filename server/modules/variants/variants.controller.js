const variantsModel = require('./variants.model');

async function getAttributeMatrix(req, res, next) {
  try {
    const data = await variantsModel.loadStoreAttributeMatrix(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listProductVariants(req, res, next) {
  try {
    const data = await variantsModel.listProductVariants(req.params.productId, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function generateVariantMatrix(req, res, next) {
  try {
    const data = await variantsModel.generateVariantMatrix(
      req.params.productId,
      req.user.storeId,
      req.body
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateVariant(req, res, next) {
  try {
    const data = await variantsModel.updateVariant(req.params.id, req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deactivateVariant(req, res, next) {
  try {
    const data = await variantsModel.deactivateVariant(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAttributeMatrix,
  listProductVariants,
  generateVariantMatrix,
  updateVariant,
  deactivateVariant,
};
