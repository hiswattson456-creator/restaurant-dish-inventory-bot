/**
 * Обработчик команды /start — переходит в каталог складов.
 */
async function startCommand(ctx) {
  await ctx.scene.enter('catalog_warehouse');
}

module.exports = startCommand;
