import { kv } from '@vercel/kv';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export const USERS_KEY = 'kopilka-300k:tg-users:v1';

export function isBotConfigured() {
  return Boolean(BOT_TOKEN);
}

// Все подписанные пользователи, которым нужно присылать уведомления
export async function getNotifyUsers() {
  const users = (await kv.get(USERS_KEY)) || {};
  return Object.values(users).filter(u => u && u.notify);
}

// Отправить одно сообщение всем подписчикам. Возвращает статистику доставки.
export async function broadcast(text, options = {}) {
  const list = await getNotifyUsers();
  if (list.length === 0) return { sent: 0, total: 0, failed: 0 };
  const results = await Promise.all(
    list.map(u => sendMessage(u.id, text, options))
  );
  const sent = results.filter(r => r && r.ok).length;
  return { sent, total: list.length, failed: list.length - sent };
}

export async function sendMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN не задан');
    return { ok: false };
  }
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options,
      }),
    });
    return await res.json();
  } catch (e) {
    console.error('sendMessage error:', e);
    return { ok: false };
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}