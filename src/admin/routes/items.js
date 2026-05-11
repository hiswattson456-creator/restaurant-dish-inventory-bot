const express = require('express');
const multer = require('multer');
const supabase = require('../../lib/supabase');
const { requireAuth } = require('../middleware/session');
require('dotenv').config();

const router = express.Router();
router.use(requireAuth);

// Multer хранит файл в памяти, потом отправляем в Telegram
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Только изображения'));
  },
});

// Список позиций
router.get('/', async (req, res) => {
  const { warehouse, category } = req.query;

  let query = supabase
    .from('items')
    .select('*, warehouses(name), item_categories(name, emoji)')
    .order('name');

  if (warehouse) query = query.eq('warehouse_id', warehouse);
  if (category === '0') query = query.is('category_id', null);
  else if (category) query = query.eq('category_id', category);

  const [{ data: items }, { data: warehouses }, { data: categories }] = await Promise.all([
    query,
    supabase.from('warehouses').select('id, name').eq('is_active', true).order('name'),
    supabase.from('item_categories').select('id, name, emoji').order('name'),
  ]);

  res.render('items', {
    items,
    warehouses,
    categories,
    selectedWarehouse: warehouse || '',
    selectedCategory: category || '',
    user: req.session.adminUser,
  });
});

// Создать позицию
router.post('/create', upload.single('photo'), async (req, res) => {
  const { name, warehouse_id, price, quantity, category_id } = req.body;
  let photo_file_id = null;

  if (req.file) {
    photo_file_id = await uploadPhotoToTelegram(req.file);
  }

  await supabase.from('items').insert({
    name: name.trim(),
    warehouse_id: parseInt(warehouse_id),
    price: price ? parseFloat(price) : null,
    quantity: parseInt(quantity) || 0,
    photo_file_id,
    category_id: category_id ? parseInt(category_id) : null,
  });

  res.redirect('/admin/items');
});

// Редактировать позицию
router.post('/:id/edit', upload.single('photo'), async (req, res) => {
  const { name, price, quantity, category_id } = req.body;
  const updates = {
    name: name.trim(),
    price: price ? parseFloat(price) : null,
    quantity: parseInt(quantity) || 0,
    category_id: category_id ? parseInt(category_id) : null,
    updated_at: new Date().toISOString(),
  };

  if (req.file) {
    updates.photo_file_id = await uploadPhotoToTelegram(req.file);
  }

  await supabase.from('items').update(updates).eq('id', req.params.id);
  res.redirect('/admin/items');
});

// Переключить активность
router.post('/:id/toggle', async (req, res) => {
  const { data: item } = await supabase
    .from('items')
    .select('is_active')
    .eq('id', req.params.id)
    .single();

  if (item) {
    await supabase
      .from('items')
      .update({ is_active: !item.is_active })
      .eq('id', req.params.id);
  }
  res.redirect('/admin/items');
});

// Удалить позицию
router.post('/:id/delete', async (req, res) => {
  await supabase.from('items').delete().eq('id', req.params.id);
  res.redirect('/admin/items');
});

// ── Загрузка фото через Telegram Bot API ─────────────────────────────

async function uploadPhotoToTelegram(file) {
  const axios = require('axios');
  const FormData = require('form-data');

  const form = new FormData();
  form.append('photo', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  // Отправляем фото напрямую администратору (не в групповой чат)
  const chatId = process.env.PHOTO_UPLOAD_USER_ID || '2042819654';
  const token = process.env.BOT_TOKEN;

  const response = await axios.post(
    `https://api.telegram.org/bot${token}/sendPhoto`,
    form,
    {
      params: { chat_id: chatId },
      headers: form.getHeaders(),
    }
  );

  const photoSizes = response.data.result.photo;
  const fileId = photoSizes[photoSizes.length - 1].file_id;
  const messageId = response.data.result.message_id;

  // Удаляем сообщение сразу после получения file_id
  await axios.post(
    `https://api.telegram.org/bot${token}/deleteMessage`,
    { chat_id: chatId, message_id: messageId }
  ).catch(() => {});

  return fileId;
}

module.exports = router;
