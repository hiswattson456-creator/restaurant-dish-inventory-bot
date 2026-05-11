const express = require('express');
const supabase = require('../../lib/supabase');
const { requireAuth } = require('../middleware/session');

const router = express.Router();
router.use(requireAuth);

// Список складов
router.get('/', async (req, res) => {
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*')
    .order('name');

  res.render('warehouses', { warehouses, user: req.session.adminUser });
});

// Создать склад
router.post('/create', async (req, res) => {
  const { name } = req.body;
  if (name?.trim()) {
    await supabase.from('warehouses').insert({ name: name.trim() });
  }
  res.redirect('/admin/warehouses');
});

// Переключить активность
router.post('/:id/toggle', async (req, res) => {
  const { data: wh } = await supabase
    .from('warehouses')
    .select('is_active')
    .eq('id', req.params.id)
    .single();

  if (wh) {
    await supabase
      .from('warehouses')
      .update({ is_active: !wh.is_active })
      .eq('id', req.params.id);
  }
  res.redirect('/admin/warehouses');
});

// Удалить склад
router.post('/:id/delete', async (req, res) => {
  const id = req.params.id;

  // Получаем id всех позиций склада
  const { data: items } = await supabase.from('items').select('id').eq('warehouse_id', id);
  const itemIds = (items || []).map(i => i.id);

  // Удаляем заявки на бой, связанные с позициями склада
  if (itemIds.length > 0) {
    const { error: brError } = await supabase.from('breakage_requests').delete().in('item_id', itemIds);
    if (brError) {
      console.error('[warehouses/delete] Failed to delete breakage_requests:', brError);
      return res.redirect('/admin/warehouses');
    }
  }

  // Удаляем позиции
  const { error: itemsError } = await supabase.from('items').delete().eq('warehouse_id', id);
  if (itemsError) {
    console.error('[warehouses/delete] Failed to delete items:', itemsError);
    return res.redirect('/admin/warehouses');
  }

  // Удаляем склад
  const { error } = await supabase.from('warehouses').delete().eq('id', id);
  if (error) console.error('[warehouses/delete] Supabase error:', error);
  res.redirect('/admin/warehouses');
});

// Переименовать склад
router.post('/:id/rename', async (req, res) => {
  const { name } = req.body;
  if (name?.trim()) {
    await supabase
      .from('warehouses')
      .update({ name: name.trim() })
      .eq('id', req.params.id);
  }
  res.redirect('/admin/warehouses');
});

module.exports = router;
