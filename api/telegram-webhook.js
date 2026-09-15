import { kv } from '@vercel/kv';
import { sendMessage, escapeHtml } from '../lib/telegram.js';

const USERS_KEY = 'kopilka-300k:tg-users:v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  try {
    const update = req.body;
    const msg = update?.message;
    if (!msg) return res.status(200).end();

    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();
    const firstName = msg.from?.first_name || 'друг';
    if (!chatId) return res.status(200).end();

    const users = (await kv.get(USERS_KEY)) || {};

    if (text === '/start') {
      users[chatId] = {
        id: chatId,
        name: firstName,
        username: msg.from?.username || null,
        joined_at: Date.now(),
        notify: true,
      };
      await kv.set(USERS_KEY, users);

      await sendMessage(chatId,
        `👋 Привет, <b>${escapeHtml(firstName)}</b>!\n\n` +
        `Это бот нашей копилки на <b>300 000 ₽</b> 💰\n\n` +
        `🔔 Я пришлю уведомление, когда второй участник отложит купюру.\n\n` +
        `Открой приложение кнопкой ниже 👇`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '💵 Открыть копилку', web_app: { url: process.env.WEBAPP_URL } }
            ]]
          }
        }
      );
    } else if (text === '/stop') {
      if (users[chatId]) {
        users[chatId].notify = false;
        await kv.set(USERS_KEY, users);
      }
      await sendMessage(chatId, '🔕 Уведомления выключены. Включить — /start');
    } else if (text === '/status') {
      const entries = (await kv.get('kopilka-300k:entries:v1')) || [];
      const total = entries.reduce((s, e) => s + e.amount, 0);
      const percent = Math.round((total / 300000) * 100);
      await sendMessage(chatId,
        `📊 <b>Прогресс копилки</b>\n\n` +
        `Накоплено: <b>${total.toLocaleString('ru-RU')} ₽</b>\n` +
        `Осталось: <b>${(300000 - total).toLocaleString('ru-RU')} ₽</b>\n` +
        `Прогресс: <b>${percent}%</b>`
      );
    }

    return res.status(200).end();
  } catch (e) {
    console.error('webhook error:', e);
    return res.status(200).end();
  }
}