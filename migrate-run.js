require('dotenv').config();
const {Pool}=require('pg');
const fs=require('fs');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
const sql=fs.readFileSync('migrate-catalogue.sql','utf8');
// Split on semicolons but keep multi-line statements together
const stmts=sql.split(/;\s*\n/).map(s=>s.trim()).filter(s=>s.length>2);
(async()=>{
  for(const stmt of stmts){
    try{
      await p.query(stmt);
      console.log('OK: '+stmt.substring(0,70).replace(/\n/g,' '));
    }catch(e){
      console.log('ERR: '+e.message.substring(0,100));
    }
  }
  await p.end();
  console.log('=== MIGRATION DONE ===');
})();
