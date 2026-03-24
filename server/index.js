const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'fragrance-admin-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Data helpers
const dataDir = path.join(__dirname, 'data');

function readJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf-8'));
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2));
}

// Initialize admin password on first run
(async () => {
  const admin = readJSON('admin.json');
  if (admin.password.includes('defaultHash')) {
    admin.password = await bcrypt.hash('admin123', 10);
    writeJSON('admin.json', admin);
    console.log('Admin initialized - username: admin, password: admin123');
  }
})();

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未授權' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
  }
}

// ============ Public API ============

// Get profile
app.get('/api/profile', (req, res) => {
  res.json(readJSON('profile.json'));
});

// Get all works
app.get('/api/works', (req, res) => {
  res.json(readJSON('works.json'));
});

// ============ Auth API ============

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = readJSON('admin.json');

  if (username !== admin.username) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username });
});

// Verify token
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// ============ Admin API ============

// Update profile
app.put('/api/admin/profile', authMiddleware, (req, res) => {
  const profile = req.body;
  writeJSON('profile.json', profile);
  res.json(profile);
});

// Create work
app.post('/api/admin/works', authMiddleware, (req, res) => {
  const works = readJSON('works.json');
  const newWork = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString().split('T')[0]
  };
  works.push(newWork);
  writeJSON('works.json', works);
  res.status(201).json(newWork);
});

// Update work
app.put('/api/admin/works/:id', authMiddleware, (req, res) => {
  const works = readJSON('works.json');
  const index = works.findIndex(w => w.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '作品不存在' });
  works[index] = { ...works[index], ...req.body, id: req.params.id };
  writeJSON('works.json', works);
  res.json(works[index]);
});

// Delete work
app.delete('/api/admin/works/:id', authMiddleware, (req, res) => {
  let works = readJSON('works.json');
  const index = works.findIndex(w => w.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '作品不存在' });
  works.splice(index, 1);
  writeJSON('works.json', works);
  res.json({ message: '已刪除' });
});

// Change password
app.put('/api/admin/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = readJSON('admin.json');

  const valid = await bcrypt.compare(currentPassword, admin.password);
  if (!valid) return res.status(400).json({ error: '目前密碼不正確' });

  admin.password = await bcrypt.hash(newPassword, 10);
  writeJSON('admin.json', admin);
  res.json({ message: '密碼已更新' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
