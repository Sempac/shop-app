require('dotenv').config();
const {Pool}=require('pg');
const fs=require('fs');
const path=require('path');

const pool=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
const UPLOADS=path.join(__dirname,'uploads','products');

const IDS=[411,413,328,143,156]; // photos picsum de démo

(async()=>{
  for(const pid of IDS){
    // Récupérer les fichiers
    const r=await pool.query('SELECT filename FROM product_photos WHERE product_id=$1',[pid]);
    // Supprimer les fichiers disque
    r.rows.forEach(function(row){
      var f=path.join(UPLOADS,String(pid),row.filename);
      if(fs.existsSync(f)){fs.unlinkSync(f);console.log('  🗑 '+row.filename);}
    });
    // Supprimer en base
    await pool.query('DELETE FROM product_photos WHERE product_id=$1',[pid]);
    console.log('✓ Photos supprimées pour produit ID '+pid+' ('+r.rows.length+' photo(s))');
  }
  console.log('\n✅ Photos de démo supprimées.');
  await pool.end();
})();
