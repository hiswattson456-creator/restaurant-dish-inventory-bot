const express = require('express');
const supabase = require('../../lib/supabase');
const { requireAuth } = require('../middleware/session');

const router = express.Router();
router.use(requireAuth);

// Список категорий
router.get('/', async (req, res) => {
  const [{ data: categories }, { data: counts }] = await Promise.all([
    supabase.from('item_categories').select('id, name, emoji').order('name'),
    supabase.from('items').select('category_id').not('category_id', 'is', null),
  ]);

  // Подсчёт позиций по категориям
  const countMap = {};
  for (const item of counts || []) {
    countMap[item.category_id] = (countMap[item.category_id] || 0) + 1;
  }

  const categoriesWithCount = (categories || []).map((c) => ({
    ...c,
    itemCount: countMap[c.id] || 0,
  }));

  res.render('categories', {
    categories: categoriesWithCount,
    user: req.session.adminUser,
  });
});

// Добавить категорию
router.post('/create', async (req, res) => {
  const { name, emoji } = req.body;
  if (name && name.trim()) {
    await supabase.from('item_categories').insert({
      name: name.trim(),
      emoji: emoji?.trim() || '📦',
    });
  }
  res.redirect('/admin/categories');
});

// Удалить категорию
router.post('/:id/delete', async (req, res) => {
  const id = parseInt(req.params.id);

  // Проверяем нет ли позиций с этой категорией
  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('category_id', id)
    .limit(1);

  if (items && items.length > 0) {
    // Нельзя удалить — есть позиции
    return res.redirect('/admin/categories?error=has_items');
  }

  await supabase.from('item_categories').delete().eq('id', id);
  res.redirect('/admin/categories');
});

module.exports = router;
