const customersModel = require('./customers.model');

async function listCustomers(req, res, next) {
  try {
    const data = await customersModel.listCustomers(req.user.storeId, req.query);
    res.json({ success: true, data: data.items, meta: data.meta });
  } catch (error) {
    next(error);
  }
}

async function getCustomer(req, res, next) {
  try {
    const data = await customersModel.loadCustomerById(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createCustomer(req, res, next) {
  try {
    const data = await customersModel.createCustomer(req.user.storeId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const data = await customersModel.updateCustomer(req.params.id, req.user.storeId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function deactivateCustomer(req, res, next) {
  try {
    const data = await customersModel.deactivateCustomer(req.params.id, req.user.storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
};
