require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  // Search powerbank broadly
  const r=await p.query(`SELECT id,name FROM products WHERE
    name ILIKE '%power%' OR name ILIKE '%batterie ext%' OR name ILIKE '%banque%'
    OR name ILIKE '%portable charg%'
  ORDER BY name LIMIT 20`);
  console.log('=== POWERBANK ===');
  r.rows.forEach(x=>console.log(x.id+' | '+x.name));

  // iPhone models available
  const ph=await p.query(`SELECT id,name,stock_quantity FROM products WHERE name ILIKE '%iphone%' AND stock_quantity>0 ORDER BY id LIMIT 20`);
  console.log('\n=== iPHONES ===');
  ph.rows.forEach(x=>console.log(x.id+' | '+x.name+' (stock:'+x.stock_quantity+')'));

  await p.end();
})();
