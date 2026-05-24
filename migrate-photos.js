require('dotenv').config();
const {Pool}=require('pg');
const fs=require('fs');
const path=require('path');

const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

(async()=>{
  /* Table product_photos */
  await p.query(`
    CREATE TABLE IF NOT EXISTS product_photos (
      id          SERIAL PRIMARY KEY,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      filename    VARCHAR(255) NOT NULL,
      sort_order  INTEGER DEFAULT 0,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_pp_product ON product_photos(product_id)`);
  console.log('✓ Table product_photos créée');

  /* Dossier uploads/products */
  const dir=path.join(__dirname,'uploads','products');
  if(!fs.existsSync(dir)){fs.mkdirSync(dir,{recursive:true});console.log('✓ Dossier uploads/products créé');}
  else console.log('✓ Dossier uploads/products existe déjà');

  const r=await p.query('SELECT COUNT(*) FROM product_photos');
  console.log('✓ Photos en base :', r.rows[0].count);

  await p.end();
  console.log('\n✅ Migration photos terminée.');
})();
