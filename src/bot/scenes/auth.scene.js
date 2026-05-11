const { Scenes, Markup } = require('telegraf');
const bcrypt = require('bcrypt');
const supabase = require('../../lib/supabase');

const authScene = new Scenes.BaseScene('auth');

authScene.enter(async (ctx) => {
  await ctx.reply(
    '🔐 Добро пожаловать!\n\nДля доступа к боту введите пароль:',
    Markup.removeKeyboard()
  );
});

authScene.on('text', async (ctx) => {
  const input = ctx.message.text.trim();

  // Шаг: ввод имени
  if (ctx.scene.state.waitingFirstName) {
    ctx.scene.state.firstName = input;
    ctx.scene.state.waitingFirstName = false;
    ctx.scene.state.waitingLastName = true;
    return ctx.reply('Введите вашу фамилию:');
  }

  // Шаг: ввод фамилии
  if (ctx.scene.state.waitingLastName) {
    const tgName = [ctx.scene.state.firstName, input].filter(Boolean).join(' ');
    const { tgId, username } = ctx.scene.state;

    await supabase.from('bot_users').upsert(
      {
        tg_id: tgId,
        tg_username: username || null,
        tg_name: tgName,
        is_active: true,
      },
      { onConflict: 'tg_id' }
    );

    await ctx.reply('✅ Регистрация завершена!');
    await ctx.scene.leave();
    return ctx.scene.enter('catalog_warehouse');
  }

  const { data: setting, error } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', 'bot_password')
    .single();

  if (error || !setting) {
    return ctx.reply('⚠️ Ошибка конфигурации. Обратитесь к администратору.');
  }

  const isValid = await bcrypt.compare(input, setting.value);

  if (!isValid) {
    return ctx.reply('❌ Неверный пароль. Попробуйте снова:');
  }

  const { id: tgId, username } = ctx.from;

  // Проверяем, существует ли пользователь
  const { data: existingUser } = await supabase
    .from('bot_users')
    .select('tg_id, is_active')
    .eq('tg_id', tgId)
    .single();

  if (!existingUser) {
    // Новый пользователь — запрашиваем имя
    ctx.scene.state.waitingFirstName = true;
    ctx.scene.state.tgId = tgId;
    ctx.scene.state.username = username;
    return ctx.reply('✅ Пароль верный!\n\nВведите ваше имя:');
  }

  // Заблокированный пользователь — отказываем
  if (!existingUser.is_active) {
    return ctx.reply('🚫 Ваш аккаунт заблокирован. Обратитесь к администратору.');
  }

  // Существующий активный пользователь — обновляем только username
  await supabase.from('bot_users')
    .update({ tg_username: username || null })
    .eq('tg_id', tgId);

  await ctx.reply('✅ Авторизация успешна!');
  await ctx.scene.leave();
  return ctx.scene.enter('catalog_warehouse');
});

module.exports = authScene;
