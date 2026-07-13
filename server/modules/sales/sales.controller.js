const salesModel = require('./sales.model');

async function lookupVariant(req, res, next) {
  try {
    const data = await salesModel.lookupVariant(req.user.storeId, req.body.code);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function previewSale(req, res, next) {
  try {
    const data = await salesModel.previewSale(req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createSale(req, res, next) {
  try {
    const data = await salesModel.completeSale(req.user.storeId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listSales(req, res, next) {
  try {
    const data = await salesModel.listSales(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getSale(req, res, next) {
  try {
    const data = await salesModel.getSaleById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function voidSale(req, res, next) {
  try {
    const data = await salesModel.voidSale(req.params.id, req.user.storeId, req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listHoldCarts(req, res, next) {
  try {
    const data = await salesModel.listHoldCarts(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createHoldCart(req, res, next) {
  try {
    const data = await salesModel.createHoldCart(req.user.storeId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function resumeHoldCart(req, res, next) {
  try {
    const data = await salesModel.resumeHoldCart(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function cancelHoldCart(req, res, next) {
  try {
    const data = await salesModel.cancelHoldCart(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  lookupVariant,
  previewSale,
  createSale,
  listSales,
  getSale,
  voidSale,
  listHoldCarts,
  createHoldCart,
  resumeHoldCart,
  cancelHoldCart,
};
