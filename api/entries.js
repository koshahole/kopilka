import { kv } from '@vercel/kv';
import { sendMessage, escapeHtml } from '../lib/telegram.js';

const ENTRIES_KEY = 'kopilka-300k:entries:v1';
const USERS_KEY = 'kopilka-300k:tg-users:v1';
const TARGET_SUM = 300000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---------- GET ----------
  if (req.method === 'GET') {
    try {
      const entries = (await kv.get(ENTRIES_KEY)) || [];
      return res.status(200).json({ entries });
    } catch (e) {
      console.error('GET entries error:', e);
      return res.status(500).json({ error: 'Ошибка чтения' });
    }
  }

  // ---------- POST ----------
  if (req.method === 'POST') {
    try {
      const { date, breakdown, author } = req.body || {};
      if (!isValidDate(date) || !breakdown) {
        return res.status(400).json({ error: 'Неверный формат' });
      }
      const clean = {
        100: Math.max(0, parseInt(breakdown[100]) || 0),
        200: Math.max(0, parseInt(breakdown[200]) || 0),
        500: Math.max(0, parseInt(breakdown[500]) || 0),
        1000: Math.max(0, parseInt(breakdown[1000]) || 0),
      };
      const amount = clean[100]*100 + clean[200]*200 + clean[500]*500 + clean[1000]*1000;
      if (amount <= 0) return res.status(400).json({ error: 'Сумма должна быть больше 0' });

      const entries = (await kv.get(ENTRIES_KEY)) || [];
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date,
        amount,
        breakdown: clean,
        author: String(author || 'Кто-то').slice(0, 40),
        created_at: Date.now(),
      };
      entries.push(entry);
      await kv.set(ENTRIES_KEY, entries);

      sendNotifications({
        author: entry.author,
        amount,
        breakdown: clean,
        action: 'add',
        totalSaved: entries.reduce((s, e) => s + e.amount, 0),
      }).catch(e => console.error('notify error:', e));

      return res.status(200).json({ ok: true, entry });
    } catch (e) {
      console.error('POST entry error:', e);
      return res.status(500).json({ error: 'Ошибка записи' });
    }
  }

  // ---------- DELETE ----------
  if (req.method === 'DELETE') {
    try {
      const { id, author } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Нет id' });

      let entries = (await kv.get(ENTRIES_KEY)) || [];
      const found = entries.find(e => e.id === id);
      if (!found) return res.status(404).json({ error: 'Запись не найдена' });

      entries = entries.filter(e => e.id !== id);
      await kv.set(ENTRIES_KEY, entries);

      sendNotifications({
        author: String(author || 'Кто-то').slice(0, 40),
        amount: found.amount,
        breakdown: found.breakdown,
        action: 'remove',
        totalSaved: entries.reduce((s, e) => s + e.amount, 0),
      }).catch(e => console.error('notify error:', e));

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('DELETE entry error:', e);
      return res.status(500).json({ error: 'Ошибка удаления' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' });
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function sendNotifications({ author, amount, breakdown, action, totalSaved }) {
  try {
    const users = (await kv.get(USERS_KEY)) || {};
    const list = Object.values(users).filter(u => u.notify);
    if (list.length === 0) return;

    const isAdd = action === 'add';
    const emoji = isAdd ? '💰' : '↩️';
    const verb = isAdd ? 'отложил' : 'удалил запись на';

    const bills = [];
    if (breakdown[1000]) bills.push(`${breakdown[1000]}×1000₽`);
    if (breakdown[500])  bills.push(`${breakdown[500]}×500₽`);
    if (breakdown[200])  bills.push(`${breakdown[200]}×200₽`);
    if (breakdown[100])  bills.push(`${breakdown[100]}×100₽`);

    const percent = Math.round((totalSaved / TARGET_SUM) * 100);

    const text =
      `${emoji} <b>${escapeHtml(author)}</b> ${verb} <b>${amount.toLocaleString('ru-RU')} ₽</b>\n` +
      `💵 Купюры: ${bills.join(', ') || '—'}\n\n` +
      `🎯 Всего: <b>${totalSaved.toLocaleString('ru-RU')} ₽</b> (${percent}%)\n` +
      `Осталось: <b>${(TARGET_SUM - totalSaved).toLocaleString('ru-RU')} ₽</b>`;

    await Promise.all(list.map(u => sendMessage(u.id, text)));
  } catch (e) {
    console.error('sendNotifications error:', e);
  }
}