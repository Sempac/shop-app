require('dotenv').config();
const {Pool}=require('pg');
const fs=require('fs');
const path=require('path');
const Jimp=require('jimp');

const pool=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

const TMPDIR=path.join(__dirname,'tmp-photos');
const UPLOADS=path.join(__dirname,'uploads','products');

/* Ajouter une photo à un produit existant */
const ADD_PHOTOS=[
  { product_id:480, photos:['bb_dtek60_front.jpg'] }, // BlackBerry DTEK60 — face avant
];

/* Nouveaux produits */
const NEW_PRODUCTS=[
  {
    name:'Samsung Galaxy A5',
    category:'Smartphone',condition:'OCCASION',grade:'B',color:'Noir',
    sale_price:69,catalogue_price:69,stock_quantity:1,
    photos:['samsungA5_back.jpg','samsungA5_front.jpg'],
  },
  {
    name:'Apple iPhone 8',
    category:'Smartphone',condition:'OCCASION',grade:'B',color:'Noir',
    sale_price:50,catalogue_price:50,stock_quantity:1,
    photos:['iphone8_front.jpg','iphone8_back.jpg'],
  },
  {
    name:'LG Nexus 5X',
    category:'Smartphone',condition:'OCCASION',grade:'B',color:'Menthe',
    sale_price:50,catalogue_price:50,stock_quantity:1,
    photos:['lgnexus_mint_back.jpg','lgnexus_mint_front.jpg'],
  },
  {
    name:'Samsung Galaxy S9 Dual SIM',
    category:'Smartphone',condition:'OCCASION',grade:'B',color:'Noir',
    sale_price:100,catalogue_price:100,stock_quantity:1,
    photos:['samsungS9_back.jpg','samsungS9_front.jpg'],
  },
  {
    name:'Honor 10',
    category:'Smartphone',condition:'OCCASION',grade:'B',color:'Noir',
    sale_price:110,catalogue_price:110,stock_quantity:1,
    photos:['honor10_back.jpg','honor10_front.jpg'],
  },
];

async function processImage(srcPath,destPath){
  const img=await Jimp.read(srcPath);
  img.normalize();
  img.contrast(0.1);
  try{ img.autocrop({tolerance:0.06,cropOnlyFrames:false}); }catch(e){}
  const W=900, PAD=50;
  img.scaleToFit(W-PAD*2, W-PAD*2);
  const bg=new Jimp(W,W,0xFFFFFFFF);
  bg.composite(img, Math.floor((W-img.getWidth())/2), Math.floor((W-img.getHeight())/2));
  await bg.quality(88).writeAsync(destPath);
}

async function addPhotos(pid, photoFiles){
  const dir=path.join(UPLOADS,String(pid));
  fs.mkdirSync(dir,{recursive:true});
  const maxOrder=await pool.query('SELECT COALESCE(MAX(sort_order),-1) as m FROM product_photos WHERE product_id=$1',[pid]);
  let order=maxOrder.rows[0].m+1;
  for(const f of photoFiles){
    const src=path.join(TMPDIR,f);
    if(!fs.existsSync(src)){console.log('  ⚠️  Manquant: '+f);continue;}
    const filename=Date.now()+'-'+Math.random().toString(36).substr(2,6)+'.jpg';
    const dest=path.join(dir,filename);
    process.stdout.write('  🖼  '+f+'...');
    try{
      await processImage(src,dest);
      await pool.query('INSERT INTO product_photos(product_id,filename,sort_order) VALUES($1,$2,$3)',[pid,filename,order++]);
      console.log(' ✓');
    }catch(e){
      if(fs.existsSync(dest))fs.unlinkSync(dest);
      console.log(' ✗ ('+e.message+')');
    }
  }
}

(async()=>{
  console.log('📦 Import batch 2 — WhatsApp photos\n');

  // Ajout sur produits existants
  for(const item of ADD_PHOTOS){
    const r=await pool.query('SELECT name FROM products WHERE id=$1',[item.product_id]);
    const name=r.rows[0]?.name||'(id '+item.product_id+')';
    console.log('➕ Ajout photo à '+name+' (ID '+item.product_id+')');
    await addPhotos(item.product_id, item.photos);
  }

  // Nouveaux produits
  for(const prod of NEW_PRODUCTS){
    console.log('\n➤ '+prod.name+' ('+prod.sale_price+'€ — '+prod.color+')');
    const res=await pool.query(
      `INSERT INTO products(name,category,condition,grade,color,sale_price,catalogue_price,
        stock_quantity,statut_produit,catalogue_visible,purchase_price)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DISPONIBLE',true,0) RETURNING id`,
      [prod.name,prod.category,prod.condition,prod.grade,prod.color,
       prod.sale_price,prod.catalogue_price,prod.stock_quantity]
    );
    const pid=res.rows[0].id;
    console.log('  ✓ Produit créé — ID '+pid);
    await addPhotos(pid, prod.photos);
  }

  console.log('\n✅ Import terminé.');
  await pool.end();
})();
