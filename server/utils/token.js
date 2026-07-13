const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET is not configured', 500);
  }
  return secret;
}

function getSessionLifetime(rememberMe) {
  if (rememberMe) {
    return process.env.JWT_EXPIRES_IN || '7d';
  }
  return '8h';
}

function signAccessToken(payload, rememberMe) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getSessionLifetime(rememberMe),
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Session expired', 401);
    }
    throw new AppError('Invalid token', 401);
  }
}

function hashAccessToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getTokenExpiryDate(rememberMe) {
  const lifetime = getSessionLifetime(rememberMe);
  const match = lifetime.match(/^(\d+)([dhms])$/);
  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return new Date(Date.now() + amount * multipliers[unit]);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  hashAccessToken,
  getTokenExpiryDate,
};
