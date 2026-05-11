const expressSession = require('express-session');
const connectRedis = require('connect-redis');
const RedisStore = connectRedis(expressSession);
const Redis = require('ioredis');
require('dotenv').config();

function setupSession(app) {
  const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  app.use(
    expressSession({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || 'dev_secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // nginx enforces HTTPS; X-Forwarded-Proto not forwarded
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      },
    })
  );
}

function requireAuth(req, res, next) {
  console.log('[requireAuth] session id:', req.sessionID, '| adminUser:', req.session?.adminUser, '| protocol:', req.protocol, '| secure:', req.secure);
  if (req.session?.adminUser) return next();
  return res.redirect('/admin/login');
}

module.exports = { setupSession, requireAuth };
