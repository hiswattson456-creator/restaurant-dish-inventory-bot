require('dotenv').config();
const createBot = require('./bot/bot');
const createAdminServer = require('./admin/server');

async function main() {
  const bot = createBot();
  const app = createAdminServer();

  const PORT = process.env.PORT || 3000;

  // Запускаем Express
  app.listen(PORT, () => {
    console.log(`[admin] Server running at http://localhost:${PORT}`);
  });

  // Запускаем бота через polling (webhook можно настроить отдельно)
  await bot.launch({
    allowedUpdates: ['message', 'callback_query'],
  });

  console.log('[bot] Started (polling)');

  process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
