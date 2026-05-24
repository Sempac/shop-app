require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
const updates=[
  ["Impression A4 N&B",          0.30],
  ["Impression A4 couleur",      0.50],
  ["Photocopie A4",              0.30],
  ["Impression recto-verso A4",  0.50],
];
(async()=>{
  for(const [name,price] of updates){
    const r=await p.query("UPDATE catalogue_services SET price=$1 WHERE name=$2",[price,name]);
    console.log((r.rowCount?'✓':'✗')+' '+name+' → '+price+'€');
  }
  const check=await p.query("SELECT name,price FROM catalogue_services WHERE category='impression' ORDER BY sort_order");
  console.log('\nPrix finaux :');
  check.rows.forEach(r=>console.log('  '+r.name+' : '+Number(r.price).toFixed(2)+'€'));
  await p.end();
})();
