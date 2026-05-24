require('dotenv').config();
const {Pool}=require('pg');
const https=require('https');
const http=require('http');
const fs=require('fs');
const path=require('path');

const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

/* Produits ciblés + leurs photos (Wikipedia Commons, CC-BY-SA, libre de droits) */
const DEMO=[
  {
    product_id:410, label:'Apple iPhone 12 Pro',
    photos:[
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/IPhone_12_Pro_in_Pacific_Blue.jpeg/600px-IPhone_12_Pro_in_Pacific_Blue.jpeg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/IPhone_12_Pro_camera_system.jpeg/600px-IPhone_12_Pro_camera_system.jpeg',
    ]
  },
  {
    product_id:516, label:'Apple iPhone 14 Pro Max',
    photos:[
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/IPhone_14_Pro_Max_Deep_Purple.jpg/600px-IPhone_14_Pro_Max_Deep_Purple.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/IPhone_14_Pro_camera_system.jpg/600px-IPhone_14_Pro_camera_system.jpg',
    ]
  },
  {
    product_id:505, label:'PowerBank 30000mAh',
    photos:[
      'https://picsum.photos/seed/powerbank1/800/800',
      'https://picsum.photos/seed/powerbank2/800/800',
    ]
  },
  {
    product_id:143, label:'Chargeur Lightning 20W',
    photos:[
      'https://picsum.photos/seed/charger1/800/800',
    ]
  },
  {
    product_id:156, label:'Câble USB-C vers Lightning',
    photos:[
      'https://picsum.photos/seed/cable1/800/800',
    ]
  },
];

function download(url, dest, depth){
  depth=depth||0;
  return new Promise(function(resolve,reject){
    if(depth>5)return reject(new Error('Trop de redirections'));
    var client=url.startsWith('https')?https:http;
    client.get(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; Demo/1.0)','Accept':'image/*'}},function(res){
      if(res.statusCode===301||res.statusCode===302||res.statusCode===303){
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
        process.stdout.write('  ↓ '+imgUrl.substring(0,70)+'...');
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
