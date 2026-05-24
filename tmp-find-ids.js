require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  const r=await p.query(`SELECT id,name FROM products WHERE stock_quantity>0 AND (
    name ILIKE '%iphone%' OR name ILIKE '%samsung%' OR
    name ILIKE '%powerbank%' OR name ILIKE '%power bank%' OR name ILIKE '%power-bank%' OR
    name ILIKE '%chargeur%' OR name ILIKE '%cable%' OR name ILIKE '%câble%' OR name ILIKE '%xiaomi%'
  ) ORDER BY name LIMIT 30`);
  r.rows.forEach(x=>console.log(x.id+' | '+x.name));
  await p.end();
})();
