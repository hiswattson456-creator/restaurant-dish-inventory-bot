-- Склады
CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Позиции
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  warehouse_id INT REFERENCES warehouses(id),
  name TEXT NOT NULL,
  price NUMERIC,
  quantity INT DEFAULT 0,
  photo_file_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Заявки на бой
CREATE TABLE breakage_requests (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES items(id),
  warehouse_id INT REFERENCES warehouses(id),
  quantity INT NOT NULL,
  reason TEXT,
  photo_file_id TEXT,
  tg_user_id BIGINT,
  tg_username TEXT,
  tg_name TEXT,
  status TEXT DEFAULT 'pending',  -- pending | accepted | rejected
  admin_tg_id BIGINT,
  group_message_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Авторизованные пользователи бота
CREATE TABLE bot_users (
  id SERIAL PRIMARY KEY,
  tg_id BIGINT UNIQUE NOT NULL,
  tg_username TEXT,
  tg_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Настройки бота (пароль входа)
CREATE TABLE bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Начальный пароль будет установлен через скрипт install.sh
-- INSERT INTO bot_settings VALUES ('bot_password', '$2b$10$...');

-- Пользователи веб-админки
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
