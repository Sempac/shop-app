const {Pool}=require('pg');
const pool=new Pool({host:'localhost',port:5432,user:'postgres',password:'Sempac',database:'shop_db'});

async function run() {
  try {
    // 1. Vérifier la fonction next_numero
    const fn = await pool.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_name='next_numero' AND routine_schema='public'`);
    console.log('Fonction next_numero:', fn.rows.length ? 'OK ✅' : 'MANQUANTE ❌');

    // 2. Simuler un appel POST repairs (sans insérer)
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    try {
      const num = await pool.query("SELECT next_numero('REP',$1,'repairs','numero_rep') AS num",[dateStr]);
      console.log('next_numero retourne:', num.rows[0].num);
    } catch(e) {
      console.error('ERREUR next_numero:', e.message);
    }

    // 3. Vérifier que fetch depuis le navigateur retournerait bien les données
    const repairs = await pool.query('SELECT id, customer_name, status FROM repairs ORDER BY id DESC LIMIT 5');
    console.log('5 dernières réparations:');
    repairs.rows.forEach(r => console.log(' -', r.id, r.customer_name, r.status));

    // 4. Vérifier user sessions (table si elle existe)
    try {
      const sess = await pool.query(`SELECT COUNT(*) FROM sessions`);
      console.log('Sessions actives:', sess.rows[0].count);
    } catch(e) {
      console.log('Table sessions: inexistante (normal)');
    }

  } catch(e) {
    console.error('ERREUR GENERALE:', e.message);
  }
  pool.end();
}
run();
