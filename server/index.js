const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connectDB = require('./db');
const Admin = require('./models/Admin');
const Profile = require('./models/Profile');
const Work = require('./models/Work');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'fragrance-admin-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize admin on first run
async function initAdmin() {
  const existing = await Admin.findOne({ username: 'admin' });
  if (!existing) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashedPassword });
    console.log('Admin initialized - username: admin, password: admin123');
  }
}

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
app.get('/api/profile', async (req, res) => {
  const profile = await Profile.findOne();
  res.json(profile || {});
});

// Get all works
app.get('/api/works', async (req, res) => {
  const works = await Work.find().sort({ createdAt: -1 });
  res.json(works);
});

// ============ Auth API ============

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });

  if (!admin) {
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
app.put('/api/admin/profile', authMiddleware, async (req, res) => {
  const profile = await Profile.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true
  });
  res.json(profile);
});

// Create work
app.post('/api/admin/works', authMiddleware, async (req, res) => {
  const work = await Work.create(req.body);
  res.status(201).json(work);
});

// Update work
app.put('/api/admin/works/:id', authMiddleware, async (req, res) => {
  const work = await Work.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!work) return res.status(404).json({ error: '作品不存在' });
  res.json(work);
});

// Delete work
app.delete('/api/admin/works/:id', authMiddleware, async (req, res) => {
  const work = await Work.findByIdAndDelete(req.params.id);
  if (!work) return res.status(404).json({ error: '作品不存在' });
  res.json({ message: '已刪除' });
});

// Change password
app.put('/api/admin/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findOne({ username: req.user.username });

  const valid = await bcrypt.compare(currentPassword, admin.password);
  if (!valid) return res.status(400).json({ error: '目前密碼不正確' });

  admin.password = await bcrypt.hash(newPassword, 10);
  await admin.save();
  res.json({ message: '密碼已更新' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Connect to DB and start server
connectDB().then(async () => {
  await initAdmin();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
