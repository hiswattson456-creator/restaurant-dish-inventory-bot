const supabase = require('../../lib/supabase');

/**
 * Middleware: проверяет авторизацию пользователя.
 * Если не авторизован или деактивирован — переводит в сцену auth.
 */
async function authMiddleware(ctx, next) {
  // Пропускаем служебные апдейты без пользователя
  if (!ctx.from) return next();

  // Для inline-кнопок из группы администраторов (accept/reject) — пропускаем
  const data = ctx.callbackQuery?.data || '';
  if (data.startsWith('accept_') || data.startsWith('reject_')) {
    return next();
  }

  const tgId = ctx.from.id;

  const { data: user, error } = await supabase
    .from('bot_users')
    .select('is_active')
    .eq('tg_id', tgId)
    .single();

  if (error || !user || !user.is_active) {
    // Не авторизован или деактивирован — входим в сцену авторизации
    return ctx.scene.enter('auth');
  }

  return next();
}

module.exports = authMiddleware;
