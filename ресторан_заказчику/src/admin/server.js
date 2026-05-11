const express = require('express');
const path = require('path');
const { setupSession } = require('./middleware/session');
require('dotenv').config();

function createAdminServer() {
  const app = express();

  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  setupSession(app);

  // Маршруты
  app.use('/admin', require('./routes/auth'));
  app.use('/admin/warehouses', require('./routes/warehouses'));
  app.use('/admin/items', require('./routes/items'));
  app.use('/admin/history', require('./routes/history'));
  app.use('/admin/users', require('./routes/users'));
  app.use('/admin/settings', require('./routes/settings'));
  app.use('/admin/categories', require('./routes/categories'));

  // Редирект корня
  app.get('/', (req, res) => res.redirect('/admin/warehouses'));
  app.get('/admin', (req, res) => res.redirect('/admin/warehouses'));

  return app;
}

module.exports = createAdminServer;
