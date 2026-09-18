import { kv } from '@vercel/kv';

const CAT_KEY = 'kopilka-300k:categories:v1';
const DEFAULT_CATS = {
  income: [
    { id: 'salary',    label: 'Зарплата',    emoji: '💼', color: '#2ec27e' },
    { id: 'freelance', label: 'Фриланс',     emoji: '💻', color: '#5b8ac9' },
    { id: 'gift',      label: 'Подарок',     emoji: '🎁', color: '#c4a356' },
    { id: 'other_in',  label: 'Прочее',      emoji: '➕', color: '#7a99ac' },
  ],
  expense: [
    { id: 'food',      label: 'Продукты',    emoji: '🛒', color: '#e5484d' },
    { id: 'cafe',      label: 'Кафе',        emoji: '☕', color: '#c4a356' },
    { id: 'transport', label: 'Транспорт',   emoji: '🚌', color: '#5b8ac9' },
    { id: 'rent',      label: 'Жильё',       emoji: '🏠', color: '#7e9c62' },
    { id: 'fun',       label: 'Развлечения', emoji: '🎬', color: '#9a5b5b' },
    { id: 'other_out', label: 'Прочее',      emoji: '➖', color: '#7a99ac' },
  ],
};

function genId(label) {
  const base = label
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'cat';
  return base + '_' + Math.random().toString(36).slice(2, 6);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ----- GET -----
  if (req.method === 'GET') {
    try {
      let cats = await kv.get(CAT_KEY);
      if (!cats || !cats.income || !cats.expense) {
        cats = DEFAULT_CATS;
        await kv.set(CAT_KEY, cats);
      }
      return res.status(200).json({ categories: cats });
    } catch (e) {
      console.error('GET categories error:', e);
      return res.status(500).json({ error: 'Ошибка чтения' });
    }
  }

  // ----- POST: создать -----
  if (req.method === 'POST') {
    try {
      const { type, label, emoji, color } = req.body || {};
      if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ error: 'Тип' });
      }
      const clean = String(label || '').trim().slice(0, 30);
      if (!clean) return res.status(400).json({ error: 'Название' });

      let cats = await kv.get(CAT_KEY);
      if (!cats) cats = JSON.parse(JSON.stringify(DEFAULT_CATS));

      const cat = {
        id: genId(clean),
        label: clean,
        emoji: String(emoji || '📌').slice(0, 4),
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#7a99ac',
      };
      cats[type].push(cat);
      await kv.set(CAT_KEY, cats);
      return res.status(200).json({ ok: true, category: cat, categories: cats });
    } catch (e) {
      console.error('POST category error:', e);
      return res.status(500).json({ error: 'Ошибка создания' });
    }
  }

  // ----- DELETE -----
  if (req.method === 'DELETE') {
    try {
      const { type, id } = req.body || {};
      if ((type !== 'income' && type !== 'expense') || !id) {
        return res.status(400).json({ error: 'Параметры' });
      }
      let cats = await kv.get(CAT_KEY);
      if (!cats) cats = JSON.parse(JSON.stringify(DEFAULT_CATS));

      const before = cats[type].length;
      cats[type] = cats[type].filter(c => c.id !== id);
      if (cats[type].length === before) {
        return res.status(404).json({ error: 'Не найдена' });
      }
      await kv.set(CAT_KEY, cats);
      return res.status(200).json({ ok: true, categories: cats });
    } catch (e) {
      console.error('DELETE category error:', e);
      return res.status(500).json({ error: 'Ошибка удаления' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' });
}import { kv } from '@vercel/kv';

const CAT_KEY = 'kopilka-300k:categories:v1';
const DEFAULT_CATS = {
  income: [
    { id: 'salary',    label: 'Зарплата',    emoji: '💼', color: '#2ec27e' },
    { id: 'freelance', label: 'Фриланс',     emoji: '💻', color: '#5b8ac9' },
    { id: 'gift',      label: 'Подарок',     emoji: '🎁', color: '#c4a356' },
    { id: 'other_in',  label: 'Прочее',      emoji: '➕', color: '#7a99ac' },
  ],
  expense: [
    { id: 'food',      label: 'Продукты',    emoji: '🛒', color: '#e5484d' },
    { id: 'cafe',      label: 'Кафе',        emoji: '☕', color: '#c4a356' },
    { id: 'transport', label: 'Транспорт',   emoji: '🚌', color: '#5b8ac9' },
    { id: 'rent',      label: 'Жильё',       emoji: '🏠', color: '#7e9c62' },
    { id: 'fun',       label: 'Развлечения', emoji: '🎬', color: '#9a5b5b' },
    { id: 'other_out', label: 'Прочее',      emoji: '➖', color: '#7a99ac' },
  ],
};

function genId(label) {
  const base = label
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'cat';
  return base + '_' + Math.random().toString(36).slice(2, 6);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ----- GET -----
  if (req.method === 'GET') {
    try {
      let cats = await kv.get(CAT_KEY);
      if (!cats || !cats.income || !cats.expense) {
        cats = DEFAULT_CATS;
        await kv.set(CAT_KEY, cats);
      }
      return res.status(200).json({ categories: cats });
    } catch (e) {
      console.error('GET categories error:', e);
      return res.status(500).json({ error: 'Ошибка чтения' });
    }
  }

  // ----- POST: создать -----
  if (req.method === 'POST') {
    try {
      const { type, label, emoji, color } = req.body || {};
      if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ error: 'Тип' });
      }
      const clean = String(label || '').trim().slice(0, 30);
      if (!clean) return res.status(400).json({ error: 'Название' });

      let cats = await kv.get(CAT_KEY);
      if (!cats) cats = JSON.parse(JSON.stringify(DEFAULT_CATS));

      const cat = {
        id: genId(clean),
        label: clean,
        emoji: String(emoji || '📌').slice(0, 4),
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#7a99ac',
      };
      cats[type].push(cat);
      await kv.set(CAT_KEY, cats);
      return res.status(200).json({ ok: true, category: cat, categories: cats });
    } catch (e) {
      console.error('POST category error:', e);
      return res.status(500).json({ error: 'Ошибка создания' });
    }
  }

  // ----- DELETE -----
  if (req.method === 'DELETE') {
    try {
      const { type, id } = req.body || {};
      if ((type !== 'income' && type !== 'expense') || !id) {
        return res.status(400).json({ error: 'Параметры' });
      }
      let cats = await kv.get(CAT_KEY);
      if (!cats) cats = JSON.parse(JSON.stringify(DEFAULT_CATS));

      const before = cats[type].length;
      cats[type] = cats[type].filter(c => c.id !== id);
      if (cats[type].length === before) {
        return res.status(404).json({ error: 'Не найдена' });
      }
      await kv.set(CAT_KEY, cats);
      return res.status(200).json({ ok: true, categories: cats });
    } catch (e) {
      console.error('DELETE category error:', e);
      return res.status(500).json({ error: 'Ошибка удаления' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' });
}