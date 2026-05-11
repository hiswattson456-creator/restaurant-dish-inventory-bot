const express = require('express');
const supabase = require('../../lib/supabase');
const { requireAuth } = require('../middleware/session');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { warehouse, employee, date_from, date_to, status } = req.query;

  let query = supabase
    .from('breakage_requests')
    .select('*, items(name), warehouses(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (warehouse) query = query.eq('warehouse_id', warehouse);
  if (employee) query = query.ilike('tg_name', `%${employee}%`);
  if (status) query = query.eq('status', status);
  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to + 'T23:59:59');

  const [{ data: requests }, { data: warehouses }] = await Promise.all([
    query,
    supabase.from('warehouses').select('id, name').order('name'),
  ]);

  res.render('history', {
    requests,
    warehouses,
    filters: { warehouse, employee, date_from, date_to, status },
    user: req.session.adminUser,
  });
});

module.exports = router;
