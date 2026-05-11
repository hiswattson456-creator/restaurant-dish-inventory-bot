CREATE TABLE item_categories (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '📦'
);

INSERT INTO item_categories (name, emoji) VALUES
  ('Приборы',            '🍴'),
  ('Стеклянная посуда',  '🥃'),
  ('Деревянная посуда',  '🌿'),
  ('Керамическая посуда','🍵'),
  ('Стальная посуда',    '🔪'),
  ('Чугунная посуда',    '⚫'),
  ('Каменная посуда',    '🪨');

ALTER TABLE items ADD COLUMN category_id INT REFERENCES item_categories(id);
