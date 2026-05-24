require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  const r=await p.query(`
    SELECT category, COUNT(*) as n
    FROM products
    WHERE stock_quantity>0
    GROUP BY category ORDER BY n DESC
  `);
  console.log('=== CATEGORIES EN STOCK ===');
  r.rows.forEach(x=>console.log(x.n+'\t'+x.category));

  // Accessoires détail
  const acc=await p.query(`
    SELECT category, name FROM products
    WHERE stock_quantity>0
    AND category NOT IN ('Smartphone','Tablette','PC Portable','PC')
    ORDER BY category, name LIMIT 80
  `);
  console.log('\n=== ACCESSOIRES DETAIL ===');
  acc.rows.forEach(x=>console.log(x.category+' | '+x.name));
  await p.end();
})();
