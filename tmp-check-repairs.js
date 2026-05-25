const {Pool}=require('pg');
const pool=new Pool({host:'localhost',port:5432,user:'postgres',password:'Sempac',database:'shop_db'});
Promise.all([
  pool.query('SELECT COUNT(*) FROM repairs'),
  pool.query('SELECT COUNT(*) FROM repair_parts'),
  pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='repairs' ORDER BY ordinal_position")
]).then(([r1,r2,r3])=>{
  console.log('repairs:', r1.rows[0].count, 'lignes');
  console.log('repair_parts:', r2.rows[0].count, 'lignes');
  console.log('colonnes:', r3.rows.map(r=>r.column_name).join(', '));
  pool.end();
}).catch(e=>{console.error('ERREUR DB:',e.message);pool.end();});
