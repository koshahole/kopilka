import { kv } from '@vercel/kv';

const TX_KEY = 'kopilka-300k:transactions:v1';
const CAT_KEY = 'kopilka-300k:categories:v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' });

  try {
    const [transactions, cats] = await Promise.all([
      kv.get(TX_KEY).then(v => v || []),
      kv.get(CAT_KEY).then(v => v || { income: [], expense: [] }),
    ]);
    const now = new Date();

    const monthly = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      let income = 0, expense = 0;
      for (const tx of transactions) {
        if (tx.date.startsWith(key)) {
          if (tx.type === 'income') income += tx.amount;
          else expense += tx.amount;
        }
      }
      monthly.push({ label, income, expense, balance: income - expense });
    }

    const cumulative = [];
    let running = 0;
    for (const m of monthly) {
      running += m.balance;
      cumulative.push({ label: m.label, value: running });
    }

    // Расходы за текущий месяц по категориям
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const byCat = {};
    for (const tx of transactions) {
      const d = new Date(tx.date + 'T00:00:00');
      if (d >= monthStart && tx.type === 'expense') {
        byCat[tx.categoryId] = (byCat[tx.categoryId] || 0) + tx.amount;
      }
    }
    const topExpenses = (cats.expense || [])
      .map(c => ({ ...c, amount: byCat[c.id] || 0 }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return res.status(200).json({ monthly, cumulative, topExpenses });
  } catch (e) {
    console.error('budget-stats error:', e);
    return res.status(500).json({ error: 'Ошибка статистики' });
  }
}