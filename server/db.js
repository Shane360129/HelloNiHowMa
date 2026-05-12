const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL && process.env.NODE_ENV === 'production') {
  console.error('FATAL: DATABASE_URL is required in production.');
  process.exit(1);
}

function shouldUseSSL(url) {
  if (process.env.DB_SSL === 'false') return false;
  if (process.env.DB_SSL === 'true') return true;
  if (process.env.NODE_ENV === 'production') return true;
  if (!url) return false;
  // Supabase / Neon / Render / 任何非 localhost 都用 SSL
  return !/localhost|127\.0\.0\.1|::1/.test(url);
}

const useSSL = shouldUseSSL(DATABASE_URL);

const sequelize = new Sequelize(DATABASE_URL || 'postgres://localhost:5432/la_paisley', {
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});

async function connectDB({ sync = true } = {}) {
  try {
    await sequelize.authenticate();
    console.log(`PostgreSQL connected${useSSL ? ' (SSL enabled)' : ''}`);
    if (sync) {
      await sequelize.sync({ alter: true });
      console.log('Schema synchronized');
    }
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
