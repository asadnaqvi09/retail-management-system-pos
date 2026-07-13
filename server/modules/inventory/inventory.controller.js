const inventoryModel = require('./inventory.model');

async function listInventory(req, res, next) {
  try {
    const data = await inventoryModel.listInventory(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getInventoryItem(req, res, next) {
  try {
    const data = await inventoryModel.loadInventoryItem(req.params.variantId, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listStockMovements(req, res, next) {
  try {
    const data = await inventoryModel.listStockMovements(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function listVariantMovements(req, res, next) {
  try {
    const data = await inventoryModel.listStockMovements(req.user.storeId, {
      ...req.query,
      variantId: req.params.variantId,
    });
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function adjustStock(req, res, next) {
  try {
    const data = await inventoryModel.adjustStock(
      req.params.variantId,
      req.user.storeId,
      req.user.id,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateReorderThreshold(req, res, next) {
  try {
    const data = await inventoryModel.updateReorderThreshold(
      req.params.variantId,
      req.user.storeId,
      req.body.reorderThreshold
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listInventory,
  getInventoryItem,
  listStockMovements,
  listVariantMovements,
  adjustStock,
  updateReorderThreshold,
};
