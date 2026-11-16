const { AppError } = require('./errorHandler');
const sessionStore = require('../services/sessionStore');

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Oturum açmanız gerekiyor.', 401);
    }

    const session = await sessionStore.getAndRefresh(token);
    if (!session) {
      throw new AppError('Oturumunuz geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.', 401);
    }

    req.token = token;
    req.user = session;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const session = await sessionStore.getAndRefresh(token);
      if (session) {
        req.token = token;
        req.user = session;
      }
    }
    next();
  } catch (_err) {
    next();
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'yonetici') {
    return next(new AppError('Bu işlem için yönetici yetkisi gereklidir.', 403));
  }
  return next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
};
