const exchangesModel = require('./exchanges.model');

async function lookupSale(req, res, next) {
  try {
    const { code, customerPhone } = req.query;
    let items = [];
    if (customerPhone) {
      items = await exchangesModel.lookupSalesByCustomerPhone(req.user.storeId, customerPhone);
    } else {
      items = await exchangesModel.lookupSaleByCode(req.user.storeId, code);
    }
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

async function getEligibleSale(req, res, next) {
  try {
    const data = await exchangesModel.getEligibleSale(req.user.storeId, req.params.saleId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function previewExchange(req, res, next) {
  try {
    const data = await exchangesModel.previewExchange(req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createExchange(req, res, next) {
  try {
    const data = await exchangesModel.createExchange(req.user.storeId, req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function listExchanges(req, res, next) {
  try {
    const data = await exchangesModel.listExchanges(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getExchange(req, res, next) {
  try {
    const data = await exchangesModel.getExchangeById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  lookupSale,
  getEligibleSale,
  previewExchange,
  createExchange,
  listExchanges,
  getExchange,
};
