const express = require('express');
const supabase = require('../../lib/supabase');
const { requireAuth } = require('../middleware/session');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { data: users } = await supabase
    .from('bot_users')
    .select('*')
    .order('created_at', { ascending: false });

  res.render('users', { users, user: req.session.adminUser });
});

// Деактивировать / активировать пользователя
router.post('/:id/toggle', async (req, res) => {
  const { data: u } = await supabase
    .from('bot_users')
    .select('is_active')
    .eq('id', req.params.id)
    .single();

  if (u) {
    await supabase
      .from('bot_users')
      .update({ is_active: !u.is_active })
      .eq('id', req.params.id);
  }
  res.redirect('/admin/users');
});

module.exports = router;
