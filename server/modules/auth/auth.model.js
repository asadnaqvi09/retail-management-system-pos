const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const {
  signAccessToken,
  hashAccessToken,
  getTokenExpiryDate,
} = require('../../utils/token');

const landingRoutes = {
  dashboard: '/',
  pos: '/pos',
};

async function findActiveUserById(userId) {
  const result = await query(
    `SELECT
      u.id,
      u.store_id,
      u.role_id,
      u.name,
      u.username,
      u.email,
      u.password_hash,
      u.pin_hash,
      u.status,
      u.default_landing_screen,
      r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = $1
    LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function findActiveUserByUsername(username) {
  const result = await query(
    `SELECT
      u.id,
      u.store_id,
      u.role_id,
      u.name,
      u.username,
      u.email,
      u.password_hash,
      u.pin_hash,
      u.status,
      u.default_landing_screen,
      r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE LOWER(u.username) = LOWER($1)
    LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

async function loadRolePermissions(roleId) {
  const result = await query(
    `SELECT p.key
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = $1
     ORDER BY p.key`,
    [roleId]
  );
  return result.rows.map((row) => row.key);
}

async function verifyUserCredentials(user, { password, pin }) {
  if (password) {
    if (!user.password_hash) {
      throw new AppError('Invalid username or credentials', 401);
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError('Invalid username or credentials', 401);
    }
    return;
  }
  if (!user.pin_hash) {
    throw new AppError('Invalid username or credentials', 401);
  }
  const isValid = await bcrypt.compare(pin, user.pin_hash);
  if (!isValid) {
    throw new AppError('Invalid username or credentials', 401);
  }
}

async function createUserSession(userId, tokenHash, options) {
  const result = await query(
    `INSERT INTO user_sessions (
      id,
      user_id,
      token_hash,
      device_info,
      ip_address,
      remember_me,
      expires_at,
      last_used_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id, expires_at`,
    [
      options.sessionId,
      userId,
      tokenHash,
      options.deviceInfo || null,
      options.ipAddress || null,
      options.rememberMe,
      options.expiresAt,
    ]
  );
  return result.rows[0];
}

async function endUserSession(tokenHash) {
  await query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );
}

async function updateLastLogin(userId) {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [userId]
  );
}

function buildUserResponse(user) {
  return {
    id: user.id,
    storeId: user.store_id,
    roleId: user.role_id,
    name: user.name,
    username: user.username,
    email: user.email,
    defaultLandingScreen: user.default_landing_screen,
  };
}

function buildRoleResponse(user) {
  return {
    id: user.role_id,
    name: user.role_name,
  };
}

function resolveRedirectPath(user) {
  return landingRoutes[user.default_landing_screen] || '/';
}

async function loginUser(credentials, requestMeta) {
  const user = await findActiveUserByUsername(credentials.username);
  if (!user) {
    throw new AppError('Invalid username or credentials', 401);
  }
  if (user.status !== 'active') {
    throw new AppError('Account is inactive', 403);
  }
  await verifyUserCredentials(user, credentials);
  const permissions = await loadRolePermissions(user.role_id);
  const sessionId = uuidv4();
  const tokenPayload = {
    sub: user.id,
    sid: sessionId,
    storeId: user.store_id,
    roleId: user.role_id,
    role: user.role_name,
  };
  const accessToken = signAccessToken(tokenPayload, credentials.rememberMe);
  const tokenHash = hashAccessToken(accessToken);
  const expiresAt = getTokenExpiryDate(credentials.rememberMe);
  await createUserSession(user.id, tokenHash, {
    sessionId,
    rememberMe: credentials.rememberMe,
    deviceInfo: requestMeta.deviceInfo,
    ipAddress: requestMeta.ipAddress,
    expiresAt,
  });
  await updateLastLogin(user.id);
  return {
    token: accessToken,
    expiresAt,
    user: buildUserResponse(user),
    role: buildRoleResponse(user),
    permissions,
    redirectTo: resolveRedirectPath(user),
  };
}

async function logoutUser(accessToken) {
  const tokenHash = hashAccessToken(accessToken);
  await endUserSession(tokenHash);
  return { message: 'Logged out successfully' };
}

async function getCurrentSession(user, permissions) {
  return {
    user: {
      id: user.id,
      storeId: user.storeId,
      roleId: user.roleId,
      name: user.name,
      username: user.username,
      email: user.email,
      defaultLandingScreen: user.defaultLandingScreen,
    },
    role: {
      id: user.roleId,
      name: user.roleName,
    },
    permissions,
    redirectTo: resolveRedirectPath({
      default_landing_screen: user.defaultLandingScreen,
    }),
  };
}

async function unlockSession(userId, credentials) {
  const user = await findActiveUserById(userId);
  if (!user || user.status !== 'active') {
    throw new AppError('Unable to unlock session', 401);
  }
  try {
    await verifyUserCredentials(user, credentials);
  } catch (error) {
    throw new AppError('Invalid PIN or password', 401);
  }
  return { unlocked: true };
}

async function resetPasswordWithRecoveryCode({ username, recoveryCode, newPassword }) {
  const user = await findActiveUserByUsername(username);
  if (!user) {
    throw new AppError('Invalid recovery details', 400);
  }
  const recoveryResult = await query(
    `SELECT id, recovery_code_hash
     FROM password_recovery_codes
     WHERE store_id = $1
     LIMIT 1`,
    [user.store_id]
  );
  if (!recoveryResult.rows[0]) {
    throw new AppError('Password recovery is not configured', 400);
  }
  const recoveryMatch = await bcrypt.compare(
    recoveryCode,
    recoveryResult.rows[0].recovery_code_hash
  );
  if (!recoveryMatch) {
    throw new AppError('Invalid recovery details', 400);
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );
    await client.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [user.id]
    );
    await client.query('COMMIT');
    return { message: 'Password reset successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  loginUser,
  logoutUser,
  getCurrentSession,
  unlockSession,
  resetPasswordWithRecoveryCode,
};
