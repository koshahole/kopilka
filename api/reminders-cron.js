import { kv } from '@vercel/kv';
import { broadcast, escapeHtml, getNotifyUsers } from '../lib/telegram.js';

const REM_KEY = 'kopilka-300k:reminders:v1';

// Напоминания старше этого срока не отправляем (чтобы не приходили с большим опозданием)
const GRACE_MS = 12 * 60 * 60 * 1000;

const BEFORE_LABEL = {
  10: 'за 10 минут',
  30: 'за 30 минут',
  60: 'за час',
  180: 'за 3 часа',
  1440: 'за день',
};

function fmtDateTime(r) {
  const [y, m, d] = String(r.date).split('-');
  return `${d}.${m}.${y} в ${r.time}`;
}

/**
 * Проверка и отправка напоминаний.
 * Вызывается по cron (см. README) и «тиком» из приложения, пока оно открыто.
 * Операция идемпотентна: каждое напоминание отправляется один раз.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const reminders = (await kv.get(REM_KEY)) || [];
    if (reminders.length === 0) {
      return res.status(200).json({ ok: true, checked: 0, sent: 0 });
    }

    const now = Date.now();
    const jobs = [];
    let changed = false;

    for (const r of reminders) {
      const dueAt = Number(r.at) || 0;
      if (!dueAt) continue;
      const beforeMs = (Number(r.before) || 0) * 60000;
      const dueBefore = dueAt - beforeMs;

      // Предварительное напоминание (за N минут до события)
      if (r.before > 0 && !r.sent_before && now >= dueBefore) {
        if (now < dueAt) {
          jobs.push({ r, stage: 'before' });
        }
        r.sent_before = true; // помечаем, чтобы не отправить повторно
        changed = true;
      }

      // Напоминание в момент события
      if (!r.sent_at && now >= dueAt) {
        if (now - dueAt <= GRACE_MS) {
          jobs.push({ r, stage: 'at' });
        }
        r.sent_at = true;
        changed = true;
      }
    }

    // Сначала фиксируем статусы (защита от повторной отправки), потом шлём
    if (changed) await kv.set(REM_KEY, reminders);

    let sent = 0;
    if (jobs.length > 0) {
      const subscribers = await getNotifyUsers();
      if (subscribers.length > 0) {
        for (const { r, stage } of jobs) {
          const prefix = stage === 'before'
            ? `⏰ <b>Напоминание</b> (${BEFORE_LABEL[r.before] || `за ${r.before} мин.`})`
            : '⏰ <b>Напоминание</b>';
          const text =
            `${prefix}\n\n` +
            `📌 <b>${escapeHtml(r.text)}</b>\n` +
            `🗓 ${fmtDateTime(r)}\n` +
            `👤 ${escapeHtml(r.author || 'Кто-то')}`;
          const result = await broadcast(text);
          sent += result.sent;
        }
      }
    }

    return res.status(200).json({ ok: true, checked: reminders.length, sent });
  } catch (e) {
    console.error('reminders-cron error:', e);
    return res.status(500).json({ error: 'Ошибка обработки напоминаний' });
  }
}
