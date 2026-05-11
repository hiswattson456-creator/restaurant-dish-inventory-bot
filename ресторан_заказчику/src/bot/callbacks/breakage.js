const supabase = require('../../lib/supabase');

/**
 * Обработчик accept/reject из группы администраторов.
 * Регистрируется на уровне бота (не в сцене).
 */
async function setupBreakageCallbacks(bot) {
  // ── Принять заявку ──────────────────────────────────────────────
  bot.action(/^accept_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const reqId = parseInt(ctx.match[1]);

    const { data: req, error } = await supabase
      .from('breakage_requests')
      .select('*, items(quantity)')
      .eq('id', reqId)
      .single();

    if (error || !req) {
      return ctx.answerCbQuery('❌ Заявка не найдена', { show_alert: true });
    }

    if (req.status !== 'pending') {
      return ctx.answerCbQuery('⚠️ Заявка уже обработана', { show_alert: true });
    }

    // Списываем остаток
    const newQty = Math.max(0, req.items.quantity - req.quantity);
    await supabase
      .from('items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', req.item_id);

    // Обновляем статус
    await supabase
      .from('breakage_requests')
      .update({
        status: 'accepted',
        admin_tg_id: ctx.from.id,
      })
      .eq('id', reqId);

    // Правим кнопки в группе
    const adminName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
    try {
      await ctx.editMessageCaption(
        ctx.callbackQuery.message.caption +
          `\n\n✅ *Принята* администратором ${adminName}`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] },
        }
      );
    } catch (e) {
      console.error('[accept] edit caption error:', e.message);
    }
  });

  // ── Отклонить заявку ────────────────────────────────────────────
  bot.action(/^reject_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const reqId = parseInt(ctx.match[1]);

    const { data: req } = await supabase
      .from('breakage_requests')
      .select('status')
      .eq('id', reqId)
      .single();

    if (!req) {
      return ctx.answerCbQuery('❌ Заявка не найдена', { show_alert: true });
    }

    if (req.status !== 'pending') {
      return ctx.answerCbQuery('⚠️ Заявка уже обработана', { show_alert: true });
    }

    await supabase
      .from('breakage_requests')
      .update({
        status: 'rejected',
        admin_tg_id: ctx.from.id,
      })
      .eq('id', reqId);

    const adminName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
    try {
      await ctx.editMessageCaption(
        ctx.callbackQuery.message.caption +
          `\n\n❌ *Отклонена* администратором ${adminName}`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] },
        }
      );
    } catch (e) {
      console.error('[reject] edit caption error:', e.message);
    }
  });
}

module.exports = setupBreakageCallbacks;
