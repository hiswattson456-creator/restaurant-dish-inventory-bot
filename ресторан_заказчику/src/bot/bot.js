const { Telegraf, Scenes, session } = require('telegraf');
const Redis = require('ioredis');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const authScene = require('./scenes/auth.scene');
const catalogWarehouseScene = require('./scenes/catalog.scene');
const breakageScene = require('./scenes/breakage.scene');
const startCommand = require('./commands/start');
const setupBreakageCallbacks = require('./callbacks/breakage');

function createBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  // ── Session через Redis ─────────────────────────────────────────
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  bot.use(
    session({
      store: {
        async get(key) {
          const data = await redis.get(`tg_session:${key}`);
          return data ? JSON.parse(data) : undefined;
        },
        async set(key, val) {
          await redis.set(`tg_session:${key}`, JSON.stringify(val), 'EX', 86400);
        },
        async delete(key) {
          await redis.del(`tg_session:${key}`);
        },
      },
    })
  );

  // ── Scenes ──────────────────────────────────────────────────────
  const stage = new Scenes.Stage([authScene, catalogWarehouseScene, breakageScene]);
  bot.use(stage.middleware());

  // ── Auth middleware (после stage, чтобы scene.enter работал) ───
  bot.use(authMiddleware);

  // ── Команды ─────────────────────────────────────────────────────
  bot.start(startCommand);

  bot.command('boy', async (ctx) => {
    await ctx.scene.enter('breakage');
  });

  bot.command('admin', async (ctx) => {
    await ctx.reply('Панель управления:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '⚙️ Открыть админку', web_app: { url: 'https://anastasia-kwork.store/' } }
        ]]
      }
    });
  });

  // ── Callbacks из группы (accept/reject) ─────────────────────────
  setupBreakageCallbacks(bot);

  // ── Обработка ошибок ────────────────────────────────────────────
  bot.catch((err, ctx) => {
    console.error(`[bot] Error for ${ctx.updateType}:`, err.message);
  });

  return bot;
}

module.exports = createBot;
