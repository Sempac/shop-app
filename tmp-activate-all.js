require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  // Activer tous les produits DISPONIBLE avec un prix > 0
  const r=await p.query(`UPDATE products SET catalogue_visible=true WHERE statut_produit='DISPONIBLE' AND sale_price>0`);
  console.log('Produits activés : '+r.rowCount);
  // Afficher la liste pour info
  const list=await p.query(`SELECT id,name,category,condition,grade,sale_price,catalogue_price FROM products WHERE catalogue_visible=true ORDER BY category,name LIMIT 100`);
  console.log('\n=== PRODUITS ACTIVÉS ===');
  list.rows.forEach(function(r){
    console.log('['+r.category+'] '+r.name+' | '+r.condition+' | Grade:'+r.grade+' | '+(r.catalogue_price||r.sale_price)+'€');
  });
  console.log('\nTotal : '+list.rowCount+' produits visibles');
  // Afficher aussi les réparations actuelles
  const svc=await p.query(`SELECT id,category,name,price,price_market,delay,visible FROM catalogue_services ORDER BY category,sort_order`);
  console.log('\n=== SERVICES CATALOGUE ACTUELS ===');
  svc.rows.forEach(function(s){
    console.log('['+s.category+'] '+s.name+' | '+s.price+'€ | marché:'+s.price_market+'€ | délai:'+s.delay+' | visible:'+s.visible);
  });
  await p.end();
})();
