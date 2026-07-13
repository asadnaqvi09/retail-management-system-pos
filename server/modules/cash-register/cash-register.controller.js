const cashRegisterModel = require('./cash-register.model');

async function getCurrentSession(req, res, next) {
  try {
    const data = await cashRegisterModel.getOpenSession(req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getSession(req, res, next) {
  try {
    const data = await cashRegisterModel.getSessionById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function openSession(req, res, next) {
  try {
    const data = await cashRegisterModel.openSession(
      req.user.storeId,
      req.user.id,
      req.body.openingAmount
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function closeSession(req, res, next) {
  try {
    const data = await cashRegisterModel.closeSession(
      req.params.id,
      req.user.storeId,
      req.user.id,
      req.body
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentSession,
  getSession,
  openSession,
  closeSession,
};
