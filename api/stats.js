import { kv } from '@vercel/kv';

const ENTRIES_KEY = 'kopilka-300k:entries:v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' });

  try {
    const entries = (await kv.get(ENTRIES_KEY)) || [];
    const now = new Date();

    // ---- 1. По месяцам (за последние 12) ----
    const byMonth = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      let sum = 0;
      for (const e of entries) {
        if (e.date.startsWith(key)) sum += e.amount;
      }
      byMonth.push({ key, label, sum });
    }

    // ---- 2. По неделям (за последние 12 недель) ----
    const byWeek = [];
    const weekStartOf = (date) => {
      const d = new Date(date);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      d.setHours(0,0,0,0);
      return d;
    };
    for (let i = 11; i >= 0; i--) {
      const start = weekStartOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      let sum = 0;
      for (const e of entries) {
        const d = new Date(e.date + 'T00:00:00');
        if (d >= start && d < end) sum += e.amount;
      }
      const label = `${start.getDate()}.${String(start.getMonth()+1).padStart(2,'0')}`;
      byWeek.push({ label, sum, start: start.toISOString().slice(0,10) });
    }

    // ---- 3. Накопительная кривая (по месяцам, всего) ----
    const cumulative = [];
    let running = 0;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      let sum = 0;
      for (const e of entries) {
        if (e.date.startsWith(key)) sum += e.amount;
      }
      running += sum;
      cumulative.push({ label, sum, total: running });
    }

    // ---- 4. По дням недели (Пн..Вс) ----
    const byWeekday = [0,0,0,0,0,0,0]; // Пн..Вс
    let weekdayCount = [0,0,0,0,0,0,0];
    for (const e of entries) {
      const d = new Date(e.date + 'T00:00:00');
      const idx = (d.getDay() + 6) % 7;
      byWeekday[idx] += e.amount;
      weekdayCount[idx]++;
    }
    const weekdayLabels = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const weekdaysData = weekdayLabels.map((lbl, i) => ({
      label: lbl,
      sum: byWeekday[i],
      count: weekdayCount[i],
    }));

    return res.status(200).json({
      byMonth,
      byWeek,
      cumulative,
      weekdays: weekdaysData,
    });
  } catch (e) {
    console.error('stats error:', e);
    return res.status(500).json({ error: 'Ошибка статистики' });
  }
}