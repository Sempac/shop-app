require('dotenv').config();
const {Pool}=require('pg');
const crypto=require('crypto');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

function pin(n){let s='';for(let i=0;i<n;i++)s+=Math.floor(crypto.randomInt(0,10));return s;}

/* Règle : admin=6 chiffres, gérant=6 chiffres, vendeur=4 chiffres */
const USERS=[
  {id:9,  name:'Kader',   role:'admin',   pin_len:6},
  {id:10, name:'Hacene',  role:'gerant',  pin_len:6},
  {id:11, name:'Ramdane', role:'gerant',  pin_len:6},
  {id:12, name:'Idriss',  role:'vendeur', pin_len:4},
  {id:13, name:'Rafik',   role:'vendeur', pin_len:4},
];

(async()=>{
  // 1. Agrandir la colonne pin pour accepter 6 chiffres
  await p.query(`ALTER TABLE app_users ALTER COLUMN pin TYPE varchar(8)`);
  await p.query(`ALTER TABLE app_users ALTER COLUMN password_hash TYPE varchar(64)`);
  console.log('✓ Colonnes pin/password_hash agrandies');

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║    CONFIGURATION UTILISATEURS — The SMARTPHONE   ║');
  console.log('╠══════════════════════════════════════════════════╣');

  for(const u of USERS){
    const newPin=pin(u.pin_len);
    await p.query(
      `UPDATE app_users SET role=$1, pin=$2, password_hash=$2, auth_type='pin', updated_at=NOW() WHERE id=$3`,
      [u.role, newPin, u.id]
    );
    const icon=u.role==='admin'?'👑':u.role==='gerant'?'🔑':'👤';
    const padName=(u.name+'         ').substring(0,9);
    const padRole=(u.role+'       ').substring(0,7);
    console.log('║ '+icon+' '+padName+' ['+padRole+']  PIN: '+newPin+(u.pin_len===4?'  ':'')+'  ║');
  }
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('\n⚠️  Notez ces PINs et distribuez-les à chaque personne.');
  console.log('   Changez-les via Gestion Utilisateurs dans l\'appli.\n');

  const check=await p.query('SELECT id,name,role,pin FROM app_users WHERE is_active=true ORDER BY id');
  console.log('Vérification :');
  check.rows.forEach(r=>console.log('  '+r.name+' → role:'+r.role+' | pin:'+r.pin));
  await p.end();
})();
