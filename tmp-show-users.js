require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
(async()=>{
  // Utilisateurs
  const u=await p.query('SELECT id,name,role,auth_type,pin,password_hash,is_active FROM app_users ORDER BY id');
  console.log('=== UTILISATEURS ===');
  u.rows.forEach(r=>console.log(r.id+' | '+r.name+' | role:'+r.role+' | auth:'+r.auth_type+' | pin:'+r.pin+' | pass:'+r.password_hash+' | actif:'+r.is_active));
  // Structure table
  const cols=await p.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_name='app_users' ORDER BY ordinal_position");
  console.log('\n=== COLONNES app_users ===');
  cols.rows.forEach(c=>console.log(c.column_name+' ('+c.data_type+')'));
  // Droits par rôle (expense_categories_config)
  const ec=await p.query('SELECT category,allowed_roles FROM expense_categories_config ORDER BY category');
  console.log('\n=== EXPENSE CATEGORIES ROLES ===');
  ec.rows.forEach(r=>console.log(r.category+' → '+r.allowed_roles));
  await p.end();
})();
