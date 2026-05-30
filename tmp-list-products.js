require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  // Chercher iPhones et Samsung
  const ph=await p.query("SELECT id,name,category FROM products WHERE stock_quantity>0 AND (name ILIKE '%iphone%' OR name ILIKE '%samsung%' OR name ILIKE '%xiaomi%') ORDER BY name LIMIT 15");
  console.log('=== PHONES CONNUS ===');
  ph.rows.forEach(x=>console.log(x.id+' | '+x.category+' | '+x.name));
  // Toutes les categories
  const cats=await p.query("SELECT DISTINCT category FROM products ORDER BY category");
  console.log('\n=== CATEGORIES ===');
  cats.rows.forEach(x=>console.log(x.category));
  await p.end();
})();
