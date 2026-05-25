const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', port:5432, user:'postgres', password:'Sempac', database:'shop_db' });
pool.query("ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS orientation VARCHAR(10) DEFAULT 'portrait'")
  .then(() => { console.log('OK : colonne orientation ajoutée (ou déjà présente)'); pool.end(); })
  .catch(e => { console.error('Erreur:', e.message); pool.end(); });
