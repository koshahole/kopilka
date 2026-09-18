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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const weekStart  = new Date(now);
    const dow = (now.getDay() + 6) % 7;
    weekStart.setDate(now.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);

    let incomeMonth = 0, expenseMonth = 0;
    let incomePrev = 0, expensePrev = 0;
    let incomeWeek = 0, expenseWeek = 0;
    let incomeAll = 0, expenseAll = 0;

    const byCat = { income: {}, expense: {} };

    for (const tx of transactions) {
      const d = new Date(tx.date + 'T00:00:00');
      const isIncome = tx.type === 'income';

      if (isIncome) incomeAll += tx.amount; else expenseAll += tx.amount;

      if (d >= monthStart && d <= monthEnd) {
        if (isIncome) incomeMonth += tx.amount; else expenseMonth += tx.amount;
        byCat[tx.type][tx.categoryId] =
          (byCat[tx.type][tx.categoryId] || 0) + tx.amount;
      }
      if (d >= prevStart && d <= prevEnd) {
        if (isIncome) incomePrev += tx.amount; else expensePrev += tx.amount;
      }
      if (d >= weekStart) {
        if (isIncome) incomeWeek += tx.amount; else expenseWeek += tx.amount;
      }
    }

    // Строим массивы категорий за месяц, включая пустые
    const expand = (type) => (cats[type] || [])
      .map(c => ({ ...c, amount: byCat[type][c.id] || 0 }))
      .sort((a, b) => b.amount - a.amount);

    return res.status(200).json({
      month: { income: incomeMonth, expense: expenseMonth,
               balance: incomeMonth - expenseMonth,
               prevIncome: incomePrev, prevExpense: expensePrev,
               prevBalance: incomePrev - expensePrev },
      week:  { income: incomeWeek, expense: expenseWeek,
               balance: incomeWeek - expenseWeek },
      all:   { income: incomeAll, expense: expenseAll,
               balance: incomeAll - expenseAll },
      byCategory: { income: expand('income'), expense: expand('expense') },
    });
  } catch (e) {
    console.error('budget error:', e);
    return res.status(500).json({ error: 'Ошибка подсчёта' });
  }
}