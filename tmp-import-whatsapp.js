require('dotenv').config();
const {Pool}=require('pg');
const fs=require('fs');
const path=require('path');
const {Jimp,HorizontalAlign,VerticalAlign}=require('jimp');

const pool=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

const TMPDIR=path.join(__dirname,'tmp-photos');
const UPLOADS=path.join(__dirname,'uploads','products');

/* Produits à importer avec leurs photos (paires dos/face) */
const PRODUCTS=[
  {
    name:'Huawei Nexus 6P',
    category:'Smartphone',
    condition:'OCCASION',
    grade:'B',
    color:'Noir',
    sale_price:50,
    catalogue_price:50,
    stock_quantity:1,
    photos:['nexus6p.jpg'],
  },
  {
    name:'Samsung Galaxy XCover5',
    category:'Smartphone',
    condition:'OCCASION',
    grade:'B',
    color:'Noir',
    sale_price:60,
    catalogue_price:60,
    stock_quantity:1,
    photos:['xcover5_back.jpg','xcover5_front.jpg'],
  },
  {
    name:'Samsung Galaxy A12 32Go',
    category:'Smartphone',
    condition:'OCCASION',
    grade:'B',
    color:'Noir',
    sale_price:109,
    catalogue_price:109,
    stock_quantity:1,
    photos:['a12_back.jpg','a12_front.jpg'],
  },
  {
    name:'LG Nexus 5X',
    category:'Smartphone',
    condition:'OCCASION',
    grade:'B',
    color:'Blanc',
    sale_price:50,
    catalogue_price:50,
    stock_quantity:1,
    photos:['lgnexus_back.jpg','lgnexus_front.jpg'],
  },
  {
    name:'BlackBerry DTEK60 32Go',
    category:'Smartphone',
    condition:'OCCASION',
    grade:'B',
    color:'Noir',
    sale_price:139,
    catalogue_price:139,
    stock_quantity:1,
    photos:['blackberry_dtek60.jpg'],
  },
];

/* Nettoyage image : auto-rotate EXIF, normalise luminosité, resize 900x900 centré */
async function processImage(srcPath,destPath){
  // Jimp v1 : fromFile gère l'auto-rotation EXIF automatiquement
  const img=await Jimp.fromFile(srcPath);

  // Normalise les niveaux (auto-contrast / auto-brightness)
  img.normalize();

  // Légère amélioration de la netteté
  img.sharpen({sigma:0.6});

  // Recadrage auto des bords uniformes
  try{ img.autocrop(); }catch(e){}

  // Resize en carré 900x900 avec fond blanc, image centrée
  const W=900;
  const PAD=40;
  const maxDim=W-PAD*2;
  img.contain({w:maxDim,h:maxDim});

  // Créer fond blanc et coller l'image centrée
  const bg=new Jimp({width:W,height:W,color:0xFFFFFFFF});
  const x=Math.floor((W-img.width)/2);
  const y=Math.floor((W-img.height)/2);
  bg.composite(img,x,y);

  // Sauvegarder en JPEG qualité 88
  await bg.write(destPath,{quality:88});
}

(async()=>{
  console.log('📦 Import produits WhatsApp...\n');

  for(const prod of PRODUCTS){
    console.log('➤ '+prod.name+' ('+prod.sale_price+'€)');

    // Vérif photos sources
    const missing=prod.photos.filter(f=>!fs.existsSync(path.join(TMPDIR,f)));
    if(missing.length){
      console.log('  ⚠️  Photo(s) manquante(s) : '+missing.join(', ')+' — produit ignoré');
      continue;
    }

    // Insérer le produit
    const res=await pool.query(
      `INSERT INTO products
         (name,category,condition,grade,color,sale_price,catalogue_price,stock_quantity,
          statut_produit,catalogue_visible,purchase_price)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DISPONIBLE',true,0)
       RETURNING id`,
      [prod.name,prod.category,prod.condition,prod.grade,prod.color,
       prod.sale_price,prod.catalogue_price,prod.stock_quantity]
    );
    const pid=res.rows[0].id;
    console.log('  ✓ Produit créé — ID '+pid);

    // Créer le dossier uploads
    const dir=path.join(UPLOADS,String(pid));
    fs.mkdirSync(dir,{recursive:true});

    // Traiter et copier chaque photo
    let order=0;
    for(const photoFile of prod.photos){
      const src=path.join(TMPDIR,photoFile);
      const filename=Date.now()+'-'+Math.random().toString(36).substr(2,6)+'.jpg';
      const dest=path.join(dir,filename);
      try{
        process.stdout.write('  🖼  Traitement '+photoFile+'...');
        await processImage(src,dest);
        await pool.query(
          'INSERT INTO product_photos(product_id,filename,sort_order) VALUES($1,$2,$3)',
          [pid,filename,order++]
        );
        console.log(' ✓');
      }catch(e){
        if(fs.existsSync(dest))fs.unlinkSync(dest);
        console.log(' ✗ ('+e.message+')');
      }
    }
  }

  console.log('\n✅ Import terminé. Ouvre le catalogue pour vérifier.');
  await pool.end();
})();
