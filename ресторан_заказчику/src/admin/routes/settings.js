const express = require('express');
const bcrypt = require('bcrypt');
const supabase = require('../../lib/supabase');
const { requireAuth } = require('../middleware/session');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.render('settings', { user: req.session.adminUser, message: null, error: null });
});

// Сменить пароль бота
router.post('/bot-password', async (req, res) => {
  const { new_password, confirm_password } = req.body;

  if (!new_password || new_password !== confirm_password) {
    return res.render('settings', {
      user: req.session.adminUser,
      error: 'Пароли не совпадают',
      message: null,
    });
  }

  const hash = await bcrypt.hash(new_password, 10);
  await supabase
    .from('bot_settings')
    .upsert({ key: 'bot_password', value: hash });

  res.render('settings', {
    user: req.session.adminUser,
    message: 'Пароль бота успешно изменён',
    error: null,
  });
});

// Сменить пароль админки
router.post('/admin-password', async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('password_hash')
    .eq('id', req.session.adminUser.id)
    .single();

  const valid = await bcrypt.compare(current_password, adminUser?.password_hash || '');
  if (!valid) {
    return res.render('settings', {
      user: req.session.adminUser,
      error: 'Неверный текущий пароль',
      message: null,
    });
  }

  if (!new_password || new_password !== confirm_password) {
    return res.render('settings', {
      user: req.session.adminUser,
      error: 'Новые пароли не совпадают',
      message: null,
    });
  }

  const hash = await bcrypt.hash(new_password, 10);
  await supabase
    .from('admin_users')
    .update({ password_hash: hash })
    .eq('id', req.session.adminUser.id);

  res.render('settings', {
    user: req.session.adminUser,
    message: 'Пароль администратора изменён',
    error: null,
  });
});

module.exports = router;
