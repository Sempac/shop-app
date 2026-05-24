require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  const ids=[411,413,328,143,156];

  // Force DISPONIBLE + catalogue_visible pour les produits démo
  await p.query(
    "UPDATE products SET catalogue_visible=true, statut_produit='DISPONIBLE' WHERE id=ANY($1)",
    [ids]
  );
  console.log('✅ statut_produit=DISPONIBLE + catalogue_visible=true appliqués');

  // Vérif finale
  const r=await p.query('SELECT id,name,catalogue_visible,statut_produit,stock_quantity FROM products WHERE id=ANY($1) ORDER BY id',[ids]);
  r.rows.forEach(x=>console.log(x.id+' | cv='+x.catalogue_visible+' | statut='+x.statut_produit+' | stock='+x.stock_quantity+' | '+x.name));

  await p.end();
})();
