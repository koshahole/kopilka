import { kv } from '@vercel/kv';
import { USERS_KEY, isBotConfigured, broadcast, getNotifyUsers } from '../lib/telegram.js';

/**
 * GET  /api/notify — состояние уведомлений (настроен ли бот, кто подписан).
 * POST /api/notify — отправить тестовое уведомление всем подписчикам.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const users = (await kv.get(USERS_KEY)) || {};
      const list = Object.values(users);
      return res.status(200).json({
        botConfigured: isBotConfigured(),
        total: list.length,
        subscribed: list.filter(u => u.notify).length,
        users: list.map(u => ({
          name: u.name || 'Участник',
          username: u.username || null,
          notify: u.notify !== false,
        })),
      });
    } catch (e) {
      console.error('notify GET error:', e);
      return res.status(500).json({ error: 'Ошибка чтения' });
    }
  }

  if (req.method === 'POST') {
    try {
      if (!isBotConfigured()) {
        return res.status(400).json({
          error: 'Не задан TELEGRAM_BOT_TOKEN в переменных окружения Vercel',
        });
      }
      const subscribers = await getNotifyUsers();
      if (subscribers.length === 0) {
        return res.status(400).json({
          error: 'Нет подписчиков. Откройте приложение из бота, чтобы зарегистрироваться',
        });
      }
      const result = await broadcast(
        '🔔 <b>Проверка уведомлений</b>\n\nУведомления работают — теперь вы будете получать сообщения о доходах, расходах и напоминаниях.'
      );
      return res.status(200).json({ ok: true, ...result });
    } catch (e) {
      console.error('notify POST error:', e);
      return res.status(500).json({ error: 'Ошибка отправки' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' });
}
