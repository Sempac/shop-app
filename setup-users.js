require('dotenv').config();
const {Pool}=require('pg');
const crypto=require('crypto');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

/* Génère un PIN aléatoire de n chiffres */
function pin(n){let s='';for(let i=0;i<n;i++)s+=Math.floor(crypto.randomInt(0,10));return s;}

/* Hash SHA-256 simple (meilleur que plaintext) */
function hash(v){return crypto.createHash('sha256').update(v+'::smartphone2026').digest('hex').substring(0,20);}

const USERS=[
  {id:9,  name:'Kader',   role:'admin',   pin_len:6},
  {id:10, name:'Hacene',  role:'gerant',  pin_len:6},
  {id:11, name:'Ramdane', role:'gerant',  pin_len:6},
  {id:12, name:'Idriss',  role:'vendeur', pin_len:4},
  {id:13, name:'Rafik',   role:'vendeur', pin_len:4},
];

(async()=>{
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    CONFIGURATION UTILISATEURS — The SMARTPHONE   ║');
  console.log('╠══════════════════════════════════════════════════╣');

  for(const u of USERS){
    const newPin=pin(u.pin_len);
    // Mot de passe = hash du PIN (peut être changé manuellement)
    const newPass=hash(newPin);
    await p.query(
      `UPDATE app_users SET role=$1, pin=$2, password_hash=$3, auth_type='pin', updated_at=NOW() WHERE id=$4`,
      [u.role, newPin, newPass, u.id]
    );
    const icon=u.role==='admin'?'👑':u.role==='gerant'?'🔑':'👤';
    const padName=u.name.padEnd(8);
    const padRole=u.role.padEnd(7);
    console.log('║ '+icon+' '+padName+' ['+padRole+']  PIN: '+newPin+(u.pin_len===4?'  ':'')+'  ║');
  }
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('\n⚠️  Notez bien ces PINs — ils ne seront plus visibles ensuite.');
  console.log('   Vous pouvez les changer via /catalogue-admin → Gestion utilisateurs.\n');

  // Vérification
  const check=await p.query('SELECT id,name,role,pin,auth_type FROM app_users WHERE is_active=true ORDER BY id');
  console.log('Vérification en base :');
  check.rows.forEach(r=>console.log('  #'+r.id+' '+r.name+' | '+r.role+' | auth:'+r.auth_type+' | pin:'+r.pin));
  await p.end();
})();
