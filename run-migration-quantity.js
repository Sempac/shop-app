const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
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
