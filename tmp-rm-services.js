require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  const toDelete=["Impression photo 10x15","Impression format A2","Impression A3"];
  for(const name of toDelete){
    const r=await p.query("DELETE FROM catalogue_services WHERE name=$1",[name]);
    console.log((r.rowCount?'✓ Supprimé':'✗ Non trouvé')+' : '+name);
  }
  // Vérification finale
  const left=await p.query("SELECT name,price FROM catalogue_services WHERE category='impression' ORDER BY sort_order");
  console.log('\nImpression restantes :');
  left.rows.forEach(r=>console.log('  '+r.name+' — '+r.price+'€'));
  await p.end();
})();
