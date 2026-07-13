const dashboardModel = require('./dashboard.model');

async function getDashboardOverview(req, res, next) {
  try {
    const data = await dashboardModel.getDashboardOverview(req.user.storeId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardOverview,
};
