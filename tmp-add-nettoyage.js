require('dotenv').config();
const {Pool} = require('pg');
const p = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shop_db',
  password: process.env.DB_PASSWORD || 'Sempac',
  port: Number(process.env.DB_PORT) || 5432
});
async function run() {
  const r = await p.query(
    'INSERT INTO catalogue_services(category,name,price,sort_order,visible) VALUES($1,$2,$3,$4,$5) RETURNING id,name,sort_order',
    ['reparation', 'Nettoyage Connecteur', 0, 29, true]
  );
  console.log('OK:', JSON.stringify(r.rows[0]));
  await p.end();
}
run().catch(e => { console.error('ERR:', e.message); p.end(); });
