const { query } = require('../config/database');
const AppError = require('../utils/AppError');
const { verifyAccessToken, hashAccessToken } = require('../utils/token');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }
    const token = header.slice(7).trim();
    if (!token) {
      throw new AppError('Authentication required', 401);
    }
    const payload = verifyAccessToken(token);
    const tokenHash = hashAccessToken(token);
    const sessionResult = await query(
      `SELECT
        s.id,
        s.user_id,
        s.expires_at,
        u.id AS user_id,
        u.store_id,
        u.role_id,
        u.name,
        u.username,
        u.email,
        u.status,
        u.default_landing_screen,
        r.name AS role_name
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN roles r ON r.id = u.role_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.status = 'active'`,
      [tokenHash]
    );
    if (!sessionResult.rows[0]) {
      throw new AppError('Session invalid or expired', 401);
    }
    if (payload.sid && payload.sid !== sessionResult.rows[0].id) {
      throw new AppError('Session invalid or expired', 401);
    }
    if (payload.sub && payload.sub !== sessionResult.rows[0].user_id) {
      throw new AppError('Session invalid or expired', 401);
    }
    const session = sessionResult.rows[0];
    const permissionsResult = await query(
      `SELECT p.key
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.key`,
      [session.role_id]
    );
    await query(
      `UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1`,
      [session.id]
    );
    req.user = {
      id: session.user_id,
      storeId: session.store_id,
      roleId: session.role_id,
      roleName: session.role_name,
      name: session.name,
      username: session.username,
      email: session.email,
      defaultLandingScreen: session.default_landing_screen,
    };
    req.sessionId = session.id;
    req.permissions = permissionsResult.rows.map((row) => row.key);
    req.accessToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roleNames) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!roleNames.includes(req.user.roleName)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}

function requirePermission(...permissionKeys) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    const allowed = permissionKeys.some((key) => req.permissions.includes(key));
    if (!allowed) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  requirePermission,
};
