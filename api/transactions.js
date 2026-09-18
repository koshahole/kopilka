import { kv } from '@vercel/kv';
import { sendMessage, escapeHtml } from '../lib/telegram.js';

const TX_KEY = 'kopilka-300k:transactions:v1';
const CAT_KEY = 'kopilka-300k:categories:v1';
const USERS_KEY = 'kopilka-300k:tg-users:v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ----- GET -----
  if (req.method === 'GET') {
    try {
      const transactions = (await kv.get(TX_KEY)) || [];
      return res.status(200).json({ transactions });
    } catch (e) {
      console.error('GET tx error:', e);
      return res.status(500).json({ error: 'Ошибка чтения' });
    }
  }

  // ----- POST -----
  if (req.method === 'POST') {
    try {
      const { date, type, amount, categoryId, note, author } = req.body || {};
      if (!isValidDate(date)) return res.status(400).json({ error: 'Дата' });
      if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ error: 'Тип' });
      }
      const amt = Math.round(Number(amount));
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ error: 'Сумма' });
      }

      // Ищем категорию
      const cats = (await kv.get(CAT_KEY)) || { income: [], expense: [] };
      const cat = (cats[type] || []).find(c => c.id === categoryId);
      if (!cat) return res.status(400).json({ error: 'Категория не найдена' });

      const transactions = (await kv.get(TX_KEY)) || [];
      const tx = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date,
        type,
        amount: amt,
        categoryId: cat.id,
        categoryLabel: cat.label,
        categoryEmoji: cat.emoji,
        categoryColor: cat.color,
        note: String(note || '').slice(0, 120),
        author: String(author || 'Кто-то').slice(0, 40),
        created_at: Date.now(),
      };
      transactions.push(tx);
      await kv.set(TX_KEY, transactions);

      sendTxNotifications(tx, 'add').catch(e => console.error('notify:', e));
      return res.status(200).json({ ok: true, transaction: tx });
    } catch (e) {
      console.error('POST tx error:', e);
      return res.status(500).json({ error: 'Ошибка записи' });
    }
  }

  // ----- DELETE -----
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Нет id' });

      let transactions = (await kv.get(TX_KEY)) || [];
      const found = transactions.find(t => t.id === id);
      if (!found) return res.status(404).json({ error: 'Не найдено' });

      transactions = transactions.filter(t => t.id !== id);
      await kv.set(TX_KEY, transactions);

      sendTxNotifications(found, 'remove').catch(e => console.error('notify:', e));
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('DELETE tx error:', e);
      return res.status(500).json({ error: 'Ошибка удаления' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' });
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function sendTxNotifications(tx, action) {
  try {
    const users = (await kv.get(USERS_KEY)) || {};
    const list = Object.values(users).filter(u => u.notify);
    if (list.length === 0) return;

    const isIncome = tx.type === 'income';
    const isAdd = action === 'add';
    const emoji = isIncome ? (isAdd ? '💰' : '↩️') : (isAdd ? '💸' : '↩️');
    const verb = isAdd
      ? (isIncome ? 'получил доход' : 'потратил')
      : (isIncome ? 'удалил доход' : 'удалил расход');

    const sign = isIncome ? '+' : '−';
    const text =
      `${emoji} <b>${escapeHtml(tx.author)}</b> ${verb}\n` +
      `${tx.categoryEmoji} ${tx.categoryLabel} — <b>${sign}${tx.amount.toLocaleString('ru-RU')} ₽</b>` +
      (tx.note ? `\n📝 ${escapeHtml(tx.note)}` : '');

    await Promise.all(list.map(u => sendMessage(u.id, text)));
  } catch (e) {
    console.error('sendTxNotifications error:', e);
  }
}