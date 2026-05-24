require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  const r=await p.query(`UPDATE products SET catalogue_visible=false`);
  console.log('Produits désactivés : '+r.rowCount);
  const check=await p.query(`SELECT COUNT(*) as n FROM products WHERE catalogue_visible=true`);
  console.log('Produits encore visibles : '+check.rows[0].n);
  await p.end();
})();
