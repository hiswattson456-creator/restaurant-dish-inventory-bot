const { Scenes, Markup } = require('telegraf');
const supabase = require('../../lib/supabase');

const PAGE_SIZE = 10;

// ─── Вспомогательные функции ──────────────────────────────────────────

function warehouseKeyboard(warehouses) {
  const buttons = warehouses.map((w) =>
    [Markup.button.callback(w.name, `wh_${w.id}`)]
  );
  return Markup.inlineKeyboard(buttons);
}

function itemsKeyboard(items, page, totalPages, warehouseId, categoryId) {
  const rows = items.map((item) =>
    [Markup.button.callback(item.name, `item_${item.id}`)]
  );

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('◀️ Назад', `items_page_${warehouseId}_${categoryId}_${page - 1}`));
  if (page < totalPages - 1) nav.push(Markup.button.callback('Далее ▶️', `items_page_${warehouseId}_${categoryId}_${page + 1}`));
  if (nav.length) rows.push(nav);

  rows.push([Markup.button.callback('◀️ К категориям', `back_to_cats_${warehouseId}`)]);
  return Markup.inlineKeyboard(rows);
}

// ─── Показать клавиатуру категорий ────────────────────────────────────

async function showCategoriesKeyboard(ctx, warehouseId) {
  // Получаем активные позиции склада с категориями
  const { data: allItems } = await supabase
    .from('items')
    .select('category_id, item_categories(id, name, emoji)')
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true);

  const catMap = new Map();
  let hasUncategorized = false;

  for (const item of allItems || []) {
    if (!item.category_id) {
      hasUncategorized = true;
    } else if (!catMap.has(item.category_id)) {
      catMap.set(item.category_id, item.item_categories);
    }
  }

  if (catMap.size === 0 && !hasUncategorized) {
    // Нет позиций совсем — вернуться к складам
    return ctx.editMessageText('📦 В этом складе нет позиций.', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏠 К складам', 'back_warehouses')],
      ]).reply_markup,
    });
  }

  const rows = [];
  for (const [catId, cat] of catMap) {
    rows.push([Markup.button.callback(`${cat.emoji} ${cat.name}`, `cat_${warehouseId}_${catId}`)]);
  }
  if (hasUncategorized) {
    rows.push([Markup.button.callback('📦 Без категории', `cat_${warehouseId}_0`)]);
  }
  rows.push([Markup.button.callback('🏠 К складам', 'back_warehouses')]);

  try {
    await ctx.editMessageText('📂 Выберите категорию:', Markup.inlineKeyboard(rows));
  } catch {
    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply('📂 Выберите категорию:', Markup.inlineKeyboard(rows));
  }
}

// ─── Показать страницу позиций ─────────────────────────────────────────

async function showItemsPage(ctx, warehouseId, page, categoryId = null) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('items')
    .select('id, name', { count: 'exact' })
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .order('name')
    .range(from, to);

  if (categoryId === 0) query = query.is('category_id', null);
  else if (categoryId) query = query.eq('category_id', categoryId);

  const { data: items, count } = await query;

  if (!items || items.length === 0) {
    return ctx.editMessageText('📦 В этой категории нет позиций.', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('◀️ К категориям', `back_to_cats_${warehouseId}`)],
      ]).reply_markup,
    });
  }

  const { data: wh } = await supabase
    .from('warehouses')
    .select('name')
    .eq('id', warehouseId)
    .single();

  const totalPages = Math.ceil(count / PAGE_SIZE);

  try {
    await ctx.editMessageText(
      `🏬 *${wh?.name || 'Склад'}*\nСтраница ${page + 1}/${totalPages}`,
      {
        parse_mode: 'Markdown',
        ...itemsKeyboard(items, page, totalPages, warehouseId, categoryId ?? 'null'),
      }
    );
  } catch {
    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply(
      `🏬 *${wh?.name || 'Склад'}*\nСтраница ${page + 1}/${totalPages}`,
      {
        parse_mode: 'Markdown',
        ...itemsKeyboard(items, page, totalPages, warehouseId, categoryId ?? 'null'),
      }
    );
  }
}

// ─── Сцена ───────────────────────────────────────────────────────────

const catalogWarehouseScene = new Scenes.BaseScene('catalog_warehouse');

catalogWarehouseScene.enter(async (ctx) => {
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (!warehouses || warehouses.length === 0) {
    return ctx.reply('📦 Нет доступных складов.');
  }

  ctx.scene.state.warehouses = warehouses;

  await ctx.reply('🏬 Выберите склад:', warehouseKeyboard(warehouses));
});

// Выбор склада → показать категории
catalogWarehouseScene.action(/^wh_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const warehouseId = parseInt(ctx.match[1]);
  await showCategoriesKeyboard(ctx, warehouseId);
});

// Выбор категории → список позиций
catalogWarehouseScene.action(/^cat_(\d+)_(\w+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const warehouseId = parseInt(ctx.match[1]);
  const catRaw = ctx.match[2];
  const categoryId = catRaw === 'null' ? null : parseInt(catRaw);
  await showItemsPage(ctx, warehouseId, 0, categoryId);
});

// Пагинация позиций
catalogWarehouseScene.action(/^items_page_(\d+)_(\w+)_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const warehouseId = parseInt(ctx.match[1]);
  const catRaw = ctx.match[2];
  const page = parseInt(ctx.match[3]);
  const categoryId = catRaw === 'null' ? null : parseInt(catRaw);
  await showItemsPage(ctx, warehouseId, page, categoryId);
});

// Возврат к категориям
catalogWarehouseScene.action(/^back_to_cats_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const warehouseId = parseInt(ctx.match[1]);
  await showCategoriesKeyboard(ctx, warehouseId);
});

// Возврат к складам
catalogWarehouseScene.action('back_warehouses', async (ctx) => {
  await ctx.answerCbQuery();
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  await ctx.editMessageText('🏬 Выберите склад:', warehouseKeyboard(warehouses));
});

// Карточка позиции
catalogWarehouseScene.action(/^item_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const itemId = parseInt(ctx.match[1]);

  const { data: item } = await supabase
    .from('items')
    .select('*, warehouses(name), item_categories(name, emoji)')
    .eq('id', itemId)
    .single();

  if (!item) return ctx.reply('❌ Позиция не найдена.');

  const updatedAt = new Date(item.updated_at).toLocaleDateString('ru-RU');
  const price = item.price != null ? `${item.price} руб.` : 'не указана';
  const categoryStr = item.item_categories
    ? `${item.item_categories.emoji} ${item.item_categories.name}`
    : '—';

  const text =
    `📋 *${item.name}*\n\n` +
    `🏬 Склад: ${item.warehouses?.name || '—'}\n` +
    `📂 Категория: ${categoryStr}\n` +
    `💰 Цена: ${price}\n` +
    `📦 Остаток: ${item.quantity} шт.\n` +
    `📅 Обновлено: ${updatedAt}`;

  const backBtn = Markup.inlineKeyboard([
    [Markup.button.callback('◀️ Назад к списку', `wh_${item.warehouse_id}`)],
  ]);

  if (item.photo_file_id) {
    await ctx.replyWithPhoto(item.photo_file_id, {
      caption: text,
      parse_mode: 'Markdown',
      ...backBtn,
    });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', ...backBtn });
  }
});

module.exports = catalogWarehouseScene;
