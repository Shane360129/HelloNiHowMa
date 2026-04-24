const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const Admin = require('./models/Admin');
const Profile = require('./models/Profile');
const Work = require('./models/Work');
const Service = require('./models/Service');
const Setting = require('./models/Setting');

async function seed() {
  await connectDB();

  const existingAdmin = await Admin.findOne({ username: 'admin' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashedPassword });
    console.log('Admin seeded - username: admin, password: admin123');
  } else {
    console.log('Admin already exists, skipping');
  }

  const existingProfile = await Profile.findOne();
  if (!existingProfile) {
    await Profile.create({
      name: 'La Paisley',
      title: '霧眉・線條眉・韓式美眉工作室',
      tagline: '一對最適合你的眉，從這裡開始',
      bio: '我們專注於霧眉、線條眉與眉型設計，根據每位客人的臉型、膚況與個人氣質量身打造最自然、最柔和的眉型，讓你每天都能以最好的狀態出門。',
      avatar: 'https://images.unsplash.com/photo-1526045478516-99145907023c?w=600&h=600&fit=crop',
      heroImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80&fit=crop',
      email: 'hello@lapaisley.studio',
      phone: '+886 900 000 000',
      location: '台北市 ・ 預約制',
      address: '預約制・地址將於確認預約後提供',
      social: {
        instagram: 'https://instagram.com/la_paisley_2025',
        facebook: '',
        line: 'https://line.me/R/ti/p/@lapaisley',
        threads: ''
      }
    });
    console.log('Profile seeded');
  } else {
    console.log('Profile already exists, skipping');
  }

  const serviceCount = await Service.countDocuments();
  if (serviceCount === 0) {
    await Service.insertMany([
      {
        name: '韓式霧眉',
        subtitle: 'Korean Misty Brow',
        description: '以極細霧點打造柔霧感的自然眉，適合追求韓系裸妝的你。持久自然、素顏也漂亮。',
        price: 'NT$ 4,800',
        duration: '約 150 分鐘',
        image: 'https://images.unsplash.com/photo-1526045478516-99145907023c?w=800&h=600&fit=crop',
        featured: true,
        order: 1
      },
      {
        name: '裸感線條眉',
        subtitle: 'Hair Stroke Brow',
        description: '一筆一畫刻劃出根根分明的毛流感，像真毛般自然，適合本身眉型較清淺的客人。',
        price: 'NT$ 5,200',
        duration: '約 180 分鐘',
        image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=600&fit=crop',
        featured: true,
        order: 2
      },
      {
        name: '混合漸層眉',
        subtitle: 'Combo Brow',
        description: '結合線條與霧眉的混合技法，前段線條、後段霧感，立體又自然，是目前最熱門的選擇。',
        price: 'NT$ 5,800',
        duration: '約 180 分鐘',
        image: 'https://images.unsplash.com/photo-1571689292337-b5ea85d3a6ed?w=800&h=600&fit=crop',
        featured: true,
        order: 3
      },
      {
        name: '二次補色',
        subtitle: 'Touch Up (1 個月內)',
        description: '第一次施作後 30 - 60 天內的補色，完整呈現最終眉色與飽和度。',
        price: 'NT$ 1,000',
        duration: '約 90 分鐘',
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop',
        featured: false,
        order: 4
      },
      {
        name: '老客回補',
        subtitle: 'Annual Refresh',
        description: '施作滿 1 - 2 年的老客戶回補，讓淡去的眉色重新飽滿、維持最佳狀態。',
        price: 'NT$ 2,800 起',
        duration: '約 120 分鐘',
        image: 'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=800&h=600&fit=crop',
        featured: false,
        order: 5
      }
    ]);
    console.log('Services seeded');
  } else {
    console.log(`Services already exist (${serviceCount} items), skipping`);
  }

  const workCount = await Work.countDocuments();
  if (workCount === 0) {
    await Work.insertMany([
      {
        title: '自然柔霧眉',
        description: '搭配客人原生眉型的柔霧設計，素顏也能呈現乾淨俐落的好感妝容。',
        image: 'https://images.unsplash.com/photo-1526045478516-99145907023c?w=800&h=600&fit=crop',
        category: '韓式霧眉',
        featured: true,
        createdAt: '2025-02-12'
      },
      {
        title: '細膩毛流線條眉',
        description: '一根一根鋪排的毛流線條，由下而上呈現蓬鬆又立體的野生感。',
        image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=600&fit=crop',
        category: '線條眉',
        featured: true,
        createdAt: '2025-03-04'
      },
      {
        title: '韓系混合漸層眉',
        description: '前段線條、後段柔霧，是最受歡迎的韓系混合眉，適合不同膚質與氣質。',
        image: 'https://images.unsplash.com/photo-1571689292337-b5ea85d3a6ed?w=800&h=600&fit=crop',
        category: '漸層眉',
        featured: true,
        createdAt: '2025-03-28'
      },
      {
        title: '修眉 ・ 補色紀錄',
        description: '老客戶補色前後對比，維持原本的自然柔霧感，同時讓眉色重新飽滿。',
        image: 'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=800&h=600&fit=crop',
        category: '補色',
        featured: false,
        createdAt: '2025-04-01'
      }
    ]);
    console.log('Works seeded (4 items)');
  } else {
    console.log(`Works already exist (${workCount} items), skipping`);
  }

  const existingSettings = await Setting.findOne();
  if (!existingSettings) {
    await Setting.create({});
    console.log('Settings seeded with defaults');
  } else {
    console.log('Settings already exist, skipping');
  }

  console.log('Seed complete');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
