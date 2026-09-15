import { kv } from '@vercel/kv';

const ENTRIES_KEY = 'kopilka-300k:entries:v1';
const TARGET_SUM = 300000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' });

  try {
    const entries = (await kv.get(ENTRIES_KEY)) || [];
    const now = new Date();

    const weekStart = new Date(now);
    const dow = (now.getDay() + 6) % 7;
    weekStart.setDate(now.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    let totalAll = 0, totalWeek = 0, totalMonth = 0, totalPrevMonth = 0;
    const byNominal = { 100: 0, 200: 0, 500: 0, 1000: 0 };

    for (const e of entries) {
      const d = new Date(e.date + 'T00:00:00');
      totalAll += e.amount;
      if (d >= weekStart) totalWeek += e.amount;
      if (d >= monthStart) totalMonth += e.amount;
      if (d >= prevMonthStart && d <= prevMonthEnd) totalPrevMonth += e.amount;
      if (e.breakdown) {
        for (const k of [100, 200, 500, 1000]) {
          byNominal[k] += e.breakdown[k] || 0;
        }
      }
    }

    return res.status(200).json({
      totalAll,
      totalWeek,
      totalMonth,
      totalPrevMonth,
      target: TARGET_SUM,
      remaining: Math.max(0, TARGET_SUM - totalAll),
      percent: Math.round((totalAll / TARGET_SUM) * 100),
      byNominal,
      entriesCount: entries.length,
    });
  } catch (e) {
    console.error('summary error:', e);
    return res.status(500).json({ error: 'Ошибка подсчёта' });
  }
}