require('dotenv').config();
const {Pool}=require('pg');
const https=require('https');
const http=require('http');
const fs=require('fs');
const path=require('path');

const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

/* Produits ciblés + leurs photos (picsum.photos, service libre de droits) */
const DEMO=[
  {
    product_id:411, label:'Apple iPhone 12 Pro',
    photos:[
      'https://picsum.photos/seed/iphone12pro_a/800/800',
      'https://picsum.photos/seed/iphone12pro_b/800/800',
    ]
  },
  {
    product_id:413, label:'Apple iPhone 14 Pro Max',
    photos:[
      'https://picsum.photos/seed/iphone14promax_a/800/800',
      'https://picsum.photos/seed/iphone14promax_b/800/800',
    ]
  },
  {
    product_id:328, label:'Power Bank 22,5W - 20000 mAh',
    photos:[
      'https://picsum.photos/seed/powerbank_a/800/800',
      'https://picsum.photos/seed/powerbank_b/800/800',
    ]
  },
  {
    product_id:143, label:'Chargeur Lightning 20W',
    photos:[
      'https://picsum.photos/seed/charger20w_a/800/800',
      'https://picsum.photos/seed/charger20w_b/800/800',
    ]
  },
  {
    product_id:156, label:'Câble USB-C vers Lightning',
    photos:[
      'https://picsum.photos/seed/cableusbc_a/800/800',
      'https://picsum.photos/seed/cableusbc_b/800/800',
    ]
  },
];

function download(url, dest, depth){
  depth=depth||0;
  return new Promise(function(resolve,reject){
    if(depth>5)return reject(new Error('Trop de redirections'));
    var client=url.startsWith('https')?https:http;
    client.get(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'image/*,*/*'}},function(res){
      if(res.statusCode===301||res.statusCode===302||res.statusCode===303||res.statusCode===307||res.statusCode===308){
        return download(res.headers.location,dest,depth+1).then(resolve).catch(reject);
      }
      if(res.statusCode!==200)return reject(new Error('HTTP '+res.statusCode));
      var out=fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish',function(){out.close();resolve();});
      out.on('error',reject);
    }).on('error',reject);
  });
}

(async()=>{
  console.log('📸 Ajout de photos démo...\n');
  var total=0, ok=0;

  for(var item of DEMO){
    var pid=item.product_id;
    var dir=path.join(__dirname,'uploads','products',String(pid));
    fs.mkdirSync(dir,{recursive:true});

    /* Effacer les photos existantes pour ce produit */
    await p.query('DELETE FROM product_photos WHERE product_id=$1',[pid]);
    /* Effacer les fichiers */
    if(fs.existsSync(dir))fs.readdirSync(dir).forEach(function(f){
      fs.unlinkSync(path.join(dir,f));
    });

    console.log('📱 '+item.label+' (ID '+pid+')');
    var order=0;
    for(var imgUrl of item.photos){
      total++;
      var filename=Date.now()+'-'+Math.random().toString(36).substr(2,6)+'.jpg';
      var filepath=path.join(dir,filename);
      try{
        process.stdout.write('  ↓ '+imgUrl+'...');
        await download(imgUrl,filepath);
        await p.query(
          'INSERT INTO product_photos(product_id,filename,sort_order) VALUES($1,$2,$3)',
          [pid,filename,order++]);
        ok++;
        console.log(' ✓');
      }catch(e){
        if(fs.existsSync(filepath))fs.unlinkSync(filepath);
        console.log(' ✗ ('+e.message+')');
      }
    }
  }

  console.log('\n✅ '+ok+'/'+total+' photos téléchargées.');
  console.log('👉 Ouvre le catalogue pour voir le résultat.');
  await p.end();
})();
