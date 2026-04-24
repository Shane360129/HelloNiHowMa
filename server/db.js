const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please configure a PostgreSQL connection string.');
}

const sequelize = new Sequelize(DATABASE_URL || 'postgres://localhost:5432/la_paisley', {
  dialect: 'postgres',
  logging: false,
  dialectOptions:
    process.env.NODE_ENV === 'production'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
