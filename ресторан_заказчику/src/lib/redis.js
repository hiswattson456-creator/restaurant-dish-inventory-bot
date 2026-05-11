const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[Redis] Error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

module.exports = redis;
