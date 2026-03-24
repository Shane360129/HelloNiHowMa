const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const Admin = require('./models/Admin');
const Profile = require('./models/Profile');
const Work = require('./models/Work');

async function seed() {
  await connectDB();

  // Seed admin (only if not exists)
  const existingAdmin = await Admin.findOne({ username: 'admin' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashedPassword });
    console.log('Admin seeded - username: admin, password: admin123');
  } else {
    console.log('Admin already exists, skipping');
  }

  // Seed profile (only if not exists)
  const existingProfile = await Profile.findOne();
  if (!existingProfile) {
    await Profile.create({
      name: 'Shane',
      title: '香氛藝術家 | Fragrance Artist',
      bio: '熱愛香氛藝術，致力於將東方與西方的香氣文化融合，創造出獨特的嗅覺體驗。每一款作品都是一段故事，一種情感的表達。',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
      email: 'shane@fragrance.com',
      phone: '+886 912 345 678',
      location: '台北市，台灣',
      social: {
        instagram: 'https://instagram.com',
        facebook: 'https://facebook.com',
        line: ''
      }
    });
    console.log('Profile seeded');
  } else {
    console.log('Profile already exists, skipping');
  }

  // Seed works (only if empty)
  const workCount = await Work.countDocuments();
  if (workCount === 0) {
    await Work.insertMany([
      {
        title: '晨露花園',
        description: '以清晨花園的露珠為靈感，融合了白茶、茉莉與雪松的清新香氣，帶來寧靜與放鬆的感受。',
        image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&h=400&fit=crop',
        category: '花香調',
        notes: { top: '佛手柑、白茶', middle: '茉莉、玫瑰', base: '雪松、白麝香' },
        featured: true,
        createdAt: '2024-01-15'
      },
      {
        title: '東方夜語',
        description: '靈感源自東方夜市的溫暖氛圍，沉穩的琥珀與檀香交織出神秘而迷人的東方韻味。',
        image: 'https://images.unsplash.com/photo-1594035910387-fbd1a485b12e?w=600&h=400&fit=crop',
        category: '東方調',
        notes: { top: '荳蔻、肉桂', middle: '玫瑰、鳶尾花', base: '琥珀、檀香' },
        featured: true,
        createdAt: '2024-03-20'
      },
      {
        title: '海風漫步',
        description: '捕捉海邊漫步時的清爽感受，海鹽與柑橘的組合讓人彷彿置身於地中海沿岸。',
        image: 'https://images.unsplash.com/photo-1595425959632-34f2822322ce?w=600&h=400&fit=crop',
        category: '清新調',
        notes: { top: '海鹽、檸檬', middle: '百合、綠茶', base: '漂流木、白麝香' },
        featured: true,
        createdAt: '2024-05-10'
      },
      {
        title: '午後書房',
        description: '書頁翻動間的木質香氣，混合皮革與淡淡煙草的溫暖，適合安靜的午後時光。',
        image: 'https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?w=600&h=400&fit=crop',
        category: '木質調',
        notes: { top: '佛手柑、黑胡椒', middle: '皮革、鳶尾花', base: '雪松、香草' },
        featured: false,
        createdAt: '2024-07-01'
      }
    ]);
    console.log('Works seeded (4 items)');
  } else {
    console.log(`Works already exist (${workCount} items), skipping`);
  }

  console.log('Seed complete');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
