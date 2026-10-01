import { kv } from '@vercel/kv';

const REM_KEY = 'kopilka-300k:reminders:v1';
const MAX_REMINDERS = 500;

const ALLOWED_BEFORE = [0, 10, 30, 60, 180, 1440];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---------- GET ----------
  if (req.method === 'GET') {
    try {
      const reminders = (await kv.get(REM_KEY)) || [];
      return res.status(200).json({ reminders });
    } catch (e) {
      console.error('GET reminders error:', e);
      return res.status(500).json({ error: 'Ошибка чтения' });
    }
  }

  // ---------- POST ----------
  if (req.method === 'POST') {
    try {
      const { date, time, text, before, at, author } = req.body || {};
      if (!isValidDate(date)) return res.status(400).json({ error: 'Неверная дата' });
      if (!isValidTime(time)) return res.status(400).json({ error: 'Неверное время' });

      const cleanText = String(text || '').trim().slice(0, 120);
      if (!cleanText) return res.status(400).json({ error: 'Введите текст напоминания' });

      // Абсолютное время (мс, UTC) считает клиент — так учитывается его часовой пояс
      let atMs = Number(at);
      if (!Number.isFinite(atMs) || atMs <= 0) {
        atMs = new Date(`${date}T${time}:00`).getTime();
      }

      const beforeMin = ALLOWED_BEFORE.includes(Number(before)) ? Number(before) : 0;

      const reminders = (await kv.get(REM_KEY)) || [];
      const reminder = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date,
        time,
        at: atMs,
        text: cleanText,
        before: beforeMin,
        author: String(author || 'Кто-то').slice(0, 40),
        created_at: Date.now(),
        sent_before: false,
        sent_at: false,
      };
      reminders.push(reminder);

      // Не даём списку расти бесконечно — храним последние MAX_REMINDERS
      const trimmed = reminders
        .sort((a, b) => a.at - b.at)
        .slice(-MAX_REMINDERS);

      await kv.set(REM_KEY, trimmed);
      return res.status(200).json({ ok: true, reminder });
    } catch (e) {
      console.error('POST reminder error:', e);
      return res.status(500).json({ error: 'Ошибка записи' });
    }
  }

  // ---------- DELETE ----------
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Нет id' });

      let reminders = (await kv.get(REM_KEY)) || [];
      if (!reminders.some(r => r.id === id)) {
        return res.status(404).json({ error: 'Напоминание не найдено' });
      }
      reminders = reminders.filter(r => r.id !== id);
      await kv.set(REM_KEY, reminders);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('DELETE reminder error:', e);
      return res.status(500).json({ error: 'Ошибка удаления' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' });
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
