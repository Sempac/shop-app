require('dotenv').config();
const {Pool}=require('pg');
const pool=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  await pool.query('DELETE FROM products WHERE id IN (461,462,463,464,465,466,467,468,469,470,471,472,473,474,475)');
  console.log('✓ Produits test supprimés');
  await pool.end();
})();
