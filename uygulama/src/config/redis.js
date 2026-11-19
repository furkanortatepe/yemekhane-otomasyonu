const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redis.on('connect', () => {
  console.log('[REDIS] Redis bağlantısı kuruldu.');
});

redis.on('error', (err) => {
  console.error('[REDIS HATA]', err.message);
});

module.exports = redis;
