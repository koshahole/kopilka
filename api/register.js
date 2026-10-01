import { kv } from '@vercel/kv';
import { USERS_KEY } from '../lib/telegram.js';

/**
 * Регистрация пользователя Telegram Mini App для рассылки уведомлений.
 * Вызывается автоматически при открытии приложения — не требует команды /start.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  try {
    const { id, name, username } = req.body || {};
    const chatId = String(id || '').trim();
    if (!chatId) return res.status(400).json({ error: 'Нет id пользователя' });

    const users = (await kv.get(USERS_KEY)) || {};
    const prev = users[chatId] || {};

    users[chatId] = {
      id: chatId,
      name: String(name || prev.name || 'Участник').slice(0, 40),
      username: username ? String(username).slice(0, 40) : (prev.username || null),
      joined_at: prev.joined_at || Date.now(),
      notify: prev.notify !== false,
      last_seen: Date.now(),
    };

    await kv.set(USERS_KEY, users);
    return res.status(200).json({ ok: true, notify: users[chatId].notify });
  } catch (e) {
    console.error('register error:', e);
    return res.status(500).json({ error: 'Ошибка регистрации' });
  }
}
