const authModel = require('./auth.model');

function getRequestMeta(req) {
  return {
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    deviceInfo: req.headers['user-agent'] || null,
  };
}

async function login(req, res, next) {
  try {
    const data = await authModel.loginUser(req.body, getRequestMeta(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const data = await authModel.logoutUser(req.accessToken);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getSession(req, res, next) {
  try {
    const data = await authModel.getCurrentSession(req.user, req.permissions);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const data = await authModel.resetPasswordWithRecoveryCode(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function unlockSession(req, res, next) {
  try {
    const data = await authModel.unlockSession(req.user.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function adminOnly(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        message: 'Admin access granted',
        user: req.user.username,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  logout,
  getSession,
  unlockSession,
  forgotPassword,
  adminOnly,
};
