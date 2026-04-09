const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'menu.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ───────────────────────────────────────────
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── PUBLIC API ────────────────────────────────────────

// Повне меню для фронту (тільки visible)
app.get('/api/menu', (req, res) => {
  const data = readData();
  res.json({
    categories:    data.categories.filter(c => c.visible),
    subcategories: data.subcategories,
    items:         data.items.filter(i => i.visible).sort((a, b) => a.order - b.order),
    settings:      data.settings
  });
});

// ─── ADMIN API ─────────────────────────────────────────

// Все (включно з прихованим)
app.get('/api/admin/menu', (req, res) => res.json(readData()));

// ── Налаштування ──
app.put('/api/admin/settings', (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  res.json(data.settings);
});

// ── Категорії ──
app.post('/api/admin/categories', (req, res) => {
  const data = readData();
  const cat = { id: genId(), name: req.body.name, icon: req.body.icon || 'beer', visible: true };
  data.categories.push(cat);
  writeData(data);
  res.status(201).json(cat);
});

app.put('/api/admin/categories/:id', (req, res) => {
  const data = readData();
  const idx = data.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.categories[idx] = { ...data.categories[idx], ...req.body };
  writeData(data);
  res.json(data.categories[idx]);
});

app.delete('/api/admin/categories/:id', (req, res) => {
  const data = readData();
  data.categories = data.categories.filter(c => c.id !== req.params.id);
  data.items = data.items.filter(i => i.categoryId !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// ── Підкатегорії ──
app.post('/api/admin/subcategories', (req, res) => {
  const data = readData();
  const sub = { id: genId(), categoryId: req.body.categoryId, name: req.body.name };
  data.subcategories.push(sub);
  writeData(data);
  res.status(201).json(sub);
});

app.put('/api/admin/subcategories/:id', (req, res) => {
  const data = readData();
  const idx = data.subcategories.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.subcategories[idx] = { ...data.subcategories[idx], ...req.body };
  writeData(data);
  res.json(data.subcategories[idx]);
});

app.delete('/api/admin/subcategories/:id', (req, res) => {
  const data = readData();
  data.subcategories = data.subcategories.filter(s => s.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// ── Позиції меню ──
app.get('/api/admin/items', (req, res) => {
  const data = readData();
  let items = data.items;
  if (req.query.category) items = items.filter(i => i.categoryId === req.query.category);
  res.json(items.sort((a, b) => a.order - b.order));
});

app.post('/api/admin/items', (req, res) => {
  const data = readData();
  const sameCat = data.items.filter(i => i.categoryId === req.body.categoryId);
  const maxOrder = sameCat.length ? Math.max(...sameCat.map(i => i.order)) : 0;
  const item = {
    id: genId(),
    categoryId:    req.body.categoryId,
    subcategoryId: req.body.subcategoryId || null,
    name:          req.body.name,
    description:   req.body.description || '',
    price:         Number(req.body.price) || 0,
    unit:          req.body.unit || 'грн',
    badge:         req.body.badge || '',
    badgeLabel:    req.body.badgeLabel || '',
    extra:         req.body.extra || '',
    visible:       req.body.visible !== false,
    order:         maxOrder + 1
  };
  data.items.push(item);
  writeData(data);
  res.status(201).json(item);
});

app.put('/api/admin/items/:id', (req, res) => {
  const data = readData();
  const idx = data.items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.items[idx] = { ...data.items[idx], ...req.body, id: req.params.id };
  writeData(data);
  res.json(data.items[idx]);
});

app.delete('/api/admin/items/:id', (req, res) => {
  const data = readData();
  data.items = data.items.filter(i => i.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// Масовий перепорядок (drag & drop)
app.post('/api/admin/items/reorder', (req, res) => {
  // body: [{ id, order }, ...]
  const data = readData();
  req.body.forEach(({ id, order }) => {
    const item = data.items.find(i => i.id === id);
    if (item) item.order = order;
  });
  writeData(data);
  res.json({ ok: true });
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🍺 Паб Цегла сервер запущено: http://localhost:${PORT}`);
  console.log(`📋 Меню:       http://localhost:${PORT}/`);
  console.log(`🔧 Адмін:      http://localhost:${PORT}/admin`);
  console.log(`🔌 API:        http://localhost:${PORT}/api/menu\n`);
});
