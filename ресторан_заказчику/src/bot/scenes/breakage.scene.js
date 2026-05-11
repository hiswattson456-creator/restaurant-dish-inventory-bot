const { Scenes, Markup } = require('telegraf');
const supabase = require('../../lib/supabase');
require('dotenv').config();

const PAGE_SIZE = 8;
const SEARCH_PAGE_SIZE = 20;

const REASONS = ['Скол/трещина', 'Разбито', 'Брак производства', 'Другое'];

function escMd(text) {
  return String(text ?? '').replace(/[_*`[]/g, '\\$&');
}

// ── Показать клавиатуру категорий (для /boy) ──────────────────────────

async function showBCategoriesKeyboard(ctx, warehouseId) {
  const { data: allItems } = await supabase
    .from('items')
    .select('category_id, item_categories(id, name, emoji)')
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .gt('quantity', 0);

  const catMap = new Map();
  let hasUncategorized = false;

  for (const item of allItems || []) {
    if (!item.category_id) {
      hasUncategorized = true;
    } else if (!catMap.has(item.category_id)) {
      catMap.set(item.category_id, item.item_categories);
    }
  }

  const rows = [];
  for (const [catId, cat] of catMap) {
    rows.push([Markup.button.callback(`${cat.emoji} ${cat.name}`, `bcat_${catId}`)]);
  }
  if (hasUncategorized) {
    rows.push([Markup.button.callback('📦 Без категории', 'bcat_0')]);
  }
  rows.push([Markup.button.callback('🔍 Поиск по названию', 'bsearch')]);
  rows.push([Markup.button.callback('❌ Отмена', 'cancel')]);

  const text = '📂 Выберите категорию или воспользуйтесь поиском:';

  try {
    await ctx.editMessageText(text, Markup.inlineKeyboard(rows));
  } catch {
    await ctx.reply(text, Markup.inlineKeyboard(rows));
  }
}

// ── Показать страницу позиций ──────────────────────────────────────────

async function showItemsPage(ctx, warehouseId, page, categoryId) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('items')
    .select('id, name, quantity', { count: 'exact' })
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .gt('quantity', 0)
    .order('name')
    .range(from, to);

  if (categoryId === 0) query = query.is('category_id', null);
  else if (categoryId != null) query = query.eq('category_id', categoryId);

  const { data: items, count } = await query;

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const rows = (items || []).map((item) => [
    Markup.button.callback(`${item.name} (${item.quantity} шт.)`, `bitem_${item.id}`),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('◀️', `bitems_page_${page - 1}`));
  if (page < totalPages - 1) nav.push(Markup.button.callback('▶️', `bitems_page_${page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([Markup.button.callback('◀️ К категориям', 'back_to_cats')]);
  rows.push([Markup.button.callback('❌ Отмена', 'cancel')]);

  const text = `🍽 Выберите товар (стр. ${page + 1}/${totalPages || 1}):`;

  try {
    await ctx.editMessageText(text, Markup.inlineKeyboard(rows));
  } catch {
    await ctx.reply(text, Markup.inlineKeyboard(rows));
  }
}

// ── Показать результаты поиска ─────────────────────────────────────────

async function showSearchResults(ctx, warehouseId, searchQuery, page = 0) {
  const from = page * SEARCH_PAGE_SIZE;
  const to = from + SEARCH_PAGE_SIZE - 1;

  const { data: items, count } = await supabase
    .from('items')
    .select('id, name, quantity', { count: 'exact' })
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .gt('quantity', 0)
    .ilike('name', `%${searchQuery}%`)
    .order('name')
    .range(from, to);

  if (!items || items.length === 0) {
    const rows = [
      [Markup.button.callback('◀️ К категориям', 'back_to_cats')],
      [Markup.button.callback('❌ Отмена', 'cancel')],
    ];
    await ctx.reply(`❌ Ничего не найдено по запросу «${escMd(searchQuery)}». Попробуйте снова или выберите категорию.`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
    return;
  }

  const totalPages = Math.ceil(count / SEARCH_PAGE_SIZE);
  const rows = items.map((item) => [
    Markup.button.callback(`${item.name} (${item.quantity} шт.)`, `bitem_${item.id}`),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('◀️', `bsearch_page_${page - 1}`));
  if (page < totalPages - 1) nav.push(Markup.button.callback('▶️', `bsearch_page_${page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([Markup.button.callback('◀️ К категориям', 'back_to_cats')]);
  rows.push([Markup.button.callback('❌ Отмена', 'cancel')]);

  const text = `🔍 Результаты по «${searchQuery}» (стр. ${page + 1}/${totalPages}):`;
  await ctx.reply(text, Markup.inlineKeyboard(rows));
}

// ── Сцена ─────────────────────────────────────────────────────────────

const breakageScene = new Scenes.WizardScene(
  'breakage',

  // ── Шаг 1: Выбор склада ──────────────────────────────────────────
  async (ctx) => {
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (!warehouses || warehouses.length === 0) {
      await ctx.reply('❌ Нет доступных складов.');
      return ctx.scene.leave();
    }

    ctx.wizard.state.warehouses = warehouses;

    const buttons = warehouses.map((w) => [
      Markup.button.callback(w.name, `bwh_${w.id}`),
    ]);
    buttons.push([Markup.button.callback('❌ Отмена', 'cancel')]);

    await ctx.reply('🏬 Выберите склад:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },

  // ── Шаг 2: Выбор склада → показываем категории ───────────────────
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    await ctx.answerCbQuery();

    const data = ctx.callbackQuery.data;

    if (data === 'cancel') {
      await ctx.reply('Заявка отменена.');
      return ctx.scene.leave();
    }

    if (data.startsWith('bwh_')) {
      const wId = parseInt(data.replace('bwh_', ''));
      ctx.wizard.state.warehouseId = wId;
      await showBCategoriesKeyboard(ctx, wId);
      return ctx.wizard.next();
    }
  },

  // ── Шаг 3: Выбор категории / поиск / выбор товара ────────────────
  async (ctx) => {
    // Режим поиска: ждём текстовое сообщение
    if (ctx.wizard.state.searchMode && ctx.message?.text) {
      ctx.wizard.state.searchMode = false;
      const query = ctx.message.text.trim();
      ctx.wizard.state.lastSearch = query;
      await showSearchResults(ctx, ctx.wizard.state.warehouseId, query);
      return;
    }

    if (!ctx.callbackQuery) return;
    await ctx.answerCbQuery();

    const data = ctx.callbackQuery.data;

    if (data === 'cancel') {
      await ctx.reply('Заявка отменена.');
      return ctx.scene.leave();
    }

    if (data === 'back_to_cats') {
      await showBCategoriesKeyboard(ctx, ctx.wizard.state.warehouseId);
      return;
    }

    if (data.startsWith('bcat_')) {
      const catRaw = data.replace('bcat_', '');
      const catId = catRaw === '0' ? 0 : parseInt(catRaw);
      ctx.wizard.state.categoryId = catId;
      ctx.wizard.state.itemPage = 0;
      await showItemsPage(ctx, ctx.wizard.state.warehouseId, 0, catId);
      return;
    }

    if (data === 'bsearch') {
      ctx.wizard.state.searchMode = true;
      await ctx.reply('🔍 Введите название позиции:');
      return;
    }

    if (data.startsWith('bitems_page_')) {
      const page = parseInt(data.replace('bitems_page_', ''));
      ctx.wizard.state.itemPage = page;
      await showItemsPage(ctx, ctx.wizard.state.warehouseId, page, ctx.wizard.state.categoryId);
      return;
    }

    if (data.startsWith('bsearch_page_')) {
      const page = parseInt(data.replace('bsearch_page_', ''));
      await showSearchResults(ctx, ctx.wizard.state.warehouseId, ctx.wizard.state.lastSearch, page);
      return;
    }

    if (data.startsWith('bitem_')) {
      const itemId = parseInt(data.replace('bitem_', ''));
      const { data: item } = await supabase
        .from('items')
        .select('id, name, quantity')
        .eq('id', itemId)
        .single();

      if (!item || item.quantity <= 0) {
        await ctx.reply('❌ Товар недоступен или остаток 0.');
        return;
      }

      ctx.wizard.state.itemId = item.id;
      ctx.wizard.state.itemName = item.name;
      ctx.wizard.state.maxQty = item.quantity;

      await ctx.reply(
        `🍽 Выбрано: *${item.name}*\n📦 Остаток: ${item.quantity} шт.\n\nВведите количество (число от 1 до ${item.quantity}):`,
        { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
      );
      return ctx.wizard.next();
    }
  },

  // ── Шаг 4: Ввод количества ────────────────────────────────────────
  async (ctx) => {
    if (ctx.callbackQuery?.data === 'cancel') {
      await ctx.answerCbQuery();
      await ctx.reply('Заявка отменена.');
      return ctx.scene.leave();
    }

    if (!ctx.message?.text) return;

    const qty = parseInt(ctx.message.text.trim());
    if (isNaN(qty) || qty <= 0) {
      return ctx.reply('⚠️ Введите целое положительное число:');
    }
    if (qty > ctx.wizard.state.maxQty) {
      return ctx.reply(`⚠️ Нельзя списать больше остатка (${ctx.wizard.state.maxQty} шт.):`);
    }

    ctx.wizard.state.quantity = qty;

    const reasonBtns = REASONS.map((r) => [Markup.button.callback(r, `reason_${r}`)]);
    reasonBtns.push([Markup.button.callback('❌ Отмена', 'cancel')]);

    await ctx.reply('🔩 Укажите причину:', Markup.inlineKeyboard(reasonBtns));
    return ctx.wizard.next();
  },

  // ── Шаг 5: Причина ───────────────────────────────────────────────
  async (ctx) => {
    // Ввод произвольной причины (после выбора "Другое")
    if (ctx.wizard.state.waitingCustomReason) {
      if (!ctx.message?.text) return;
      ctx.wizard.state.reason = ctx.message.text.trim();
      ctx.wizard.state.waitingCustomReason = false;
      await ctx.reply('📸 Прикрепите фото повреждения:');
      return ctx.wizard.next();
    }

    if (!ctx.callbackQuery) return;
    await ctx.answerCbQuery();

    const data = ctx.callbackQuery.data;

    if (data === 'cancel') {
      await ctx.reply('Заявка отменена.');
      return ctx.scene.leave();
    }

    if (data.startsWith('reason_')) {
      const reason = data.replace('reason_', '');
      if (reason === 'Другое') {
        ctx.wizard.state.waitingCustomReason = true;
        await ctx.reply('✏️ Введите причину:');
        return; // остаёмся на шаге 5
      }
      ctx.wizard.state.reason = reason;
      await ctx.reply('📸 Прикрепите фото повреждения:');
      return ctx.wizard.next();
    }
  },

  // ── Шаг 6: Фото ──────────────────────────────────────────────────
  async (ctx) => {
    if (ctx.callbackQuery?.data === 'cancel') {
      await ctx.answerCbQuery();
      await ctx.reply('Заявка отменена.');
      return ctx.scene.leave();
    }

    if (!ctx.message?.photo) {
      return ctx.reply('⚠️ Пожалуйста, отправьте фото (не файл):');
    }

    const photos = ctx.message.photo;
    ctx.wizard.state.photoFileId = photos[photos.length - 1].file_id;

    const s = ctx.wizard.state;
    const text =
      `📋 *Подтверждение заявки*\n\n` +
      `🍽 Товар: ${escMd(s.itemName)}\n` +
      `💥 Количество: ${s.quantity} шт.\n` +
      `🔩 Причина: ${escMd(s.reason)}`;

    await ctx.replyWithPhoto(s.photoFileId, {
      caption: text,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить', 'confirm'),
          Markup.button.callback('❌ Отмена', 'cancel'),
        ],
      ]),
    });

    return ctx.wizard.next();
  },

  // ── Шаг 7: Подтверждение ─────────────────────────────────────────
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    await ctx.answerCbQuery();

    const data = ctx.callbackQuery.data;

    if (data === 'cancel') {
      await ctx.reply('Заявка отменена.');
      return ctx.scene.leave();
    }

    if (data === 'confirm') {
      const s = ctx.wizard.state;
      const { from } = ctx;

      // Берём имя из БД, чтобы использовать введённое при регистрации
      const { data: botUser } = await supabase
        .from('bot_users')
        .select('tg_name')
        .eq('tg_id', from.id)
        .single();
      const tgName = botUser?.tg_name || [from.first_name, from.last_name].filter(Boolean).join(' ');

      // Сохраняем заявку
      const { data: req, error } = await supabase
        .from('breakage_requests')
        .insert({
          item_id: s.itemId,
          warehouse_id: s.warehouseId,
          quantity: s.quantity,
          reason: s.reason,
          photo_file_id: s.photoFileId,
          tg_user_id: from.id,
          tg_username: from.username || null,
          tg_name: tgName,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        await ctx.reply('❌ Ошибка при сохранении заявки. Попробуйте снова.');
        console.error('[breakage] insert error:', error);
        return ctx.scene.leave();
      }

      // Отправляем уведомление в группу
      const adminChatId = process.env.ADMIN_CHAT_ID;
      const { data: wh } = await supabase
        .from('warehouses')
        .select('name')
        .eq('id', s.warehouseId)
        .single();

      const groupText =
        `📋 *НОВАЯ ЗАЯВКА НА БОЙ ПОСУДЫ*\n\n` +
        `💥 Бой посуды\n` +
        `🏬 Склад: ${escMd(wh?.name || '—')}\n` +
        `🍽 Товар: ${escMd(s.itemName)}\n` +
        `💥 Количество: ${s.quantity} шт.\n` +
        `🔩 Причина: ${escMd(s.reason)}\n` +
        `👤 Заявитель: ${escMd(tgName)}${from.username ? ` (@${escMd(from.username)})` : ''} (ID: ${from.id})\n` +
        `🔄 Ожидает подтверждения`;

      const groupKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Принять', `accept_${req.id}`),
          Markup.button.callback('❌ Отклонить', `reject_${req.id}`),
        ],
      ]);

      try {
        const sent = await ctx.telegram.sendPhoto(adminChatId, s.photoFileId, {
          caption: groupText,
          parse_mode: 'Markdown',
          ...groupKeyboard,
        });

        // Сохраняем message_id группы
        await supabase
          .from('breakage_requests')
          .update({ group_message_id: sent.message_id })
          .eq('id', req.id);
      } catch (e) {
        console.error('[breakage] send to group error:', e.message);
      }

      await ctx.reply('✅ Заявка отправлена на рассмотрение!');
      return ctx.scene.leave();
    }
  }
);

module.exports = breakageScene;
