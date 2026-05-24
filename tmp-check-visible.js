require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  // Check visibility of demo products
  const r=await p.query('SELECT id,name,catalogue_visible,statut_produit,stock_quantity FROM products WHERE id IN (411,413,328,143,156) ORDER BY id');
  r.rows.forEach(x=>console.log(x.id+' | cv='+x.catalogue_visible+' | statut='+x.statut_produit+' | stock='+x.stock_quantity+' | '+x.name));

  // Enable catalogue_visible for all demo products that aren't already visible
  const ids=[411,413,328,143,156];
  await p.query('UPDATE products SET catalogue_visible=true WHERE id=ANY($1) AND catalogue_visible IS NOT true',[ids]);
  console.log('\n✅ catalogue_visible=true appliqué sur les produits démo');

  // Verify
  const r2=await p.query('SELECT id,name,catalogue_visible FROM products WHERE id=ANY($1) ORDER BY id',[ids]);
  r2.rows.forEach(x=>console.log(x.id+' | cv='+x.catalogue_visible+' | '+x.name));

  await p.end();
})();
