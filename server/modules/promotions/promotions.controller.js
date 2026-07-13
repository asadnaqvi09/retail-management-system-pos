const promotionsModel = require('./promotions.model');

async function listPromotions(req, res, next) {
  try {
    const data = await promotionsModel.listPromotions(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getPromotion(req, res, next) {
  try {
    const data = await promotionsModel.loadPromotionById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createPromotion(req, res, next) {
  try {
    const data = await promotionsModel.createPromotion(
      req.user.storeId,
      req.user.id,
      req.body
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updatePromotion(req, res, next) {
  try {
    const data = await promotionsModel.updatePromotion(
      req.params.id,
      req.user.storeId,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deletePromotion(req, res, next) {
  try {
    const data = await promotionsModel.deletePromotion(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
