const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'shop_db',
  password: process.env.DB_PASSWORD || 'Sempac',
  port:     Number(process.env.DB_PORT) || 5432
});

async function migrate() {
  try {
    await pool.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1');
    console.log('✅ Colonne quantity ajoutée à expenses');
    process.exit(0);
  } catch(e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
}

migrate();
