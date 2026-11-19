const crypto = require('crypto');
const redis = require('../config/redis');

const SESSION_TTL_SEC = 30 * 60; // 30 dakika
const keyOf = (token) => `oturum:${token}`;

async function create(userPayload) {
  const token = crypto.randomBytes(32).toString('hex');
  const key = keyOf(token);
  await redis.set(key, JSON.stringify(userPayload), 'EX', SESSION_TTL_SEC);
  console.log(`[REDIS SESSION] Oluşturuldu: ${key} (TTL: ${SESSION_TTL_SEC}s)`);
  return token;
}

async function getAndRefresh(token) {
  const key = keyOf(token);
  const raw = await redis.get(key);
  if (!raw) return null;

  // Sliding expiration: her istekte 30 dakika yenilenir
  await redis.expire(key, SESSION_TTL_SEC);
  return JSON.parse(raw);
}

async function remove(token) {
  const key = keyOf(token);
  await redis.del(key);
  console.log(`[REDIS SESSION] Silindi: ${key}`);
}

module.exports = {
  create,
  getAndRefresh,
  remove,
};
