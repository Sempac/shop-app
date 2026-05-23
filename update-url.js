require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});
const URL='https://desktop-dpd7qn6.taild4a8c6.ts.net/catalogue';
(async()=>{
  try{
    const r=await p.query("UPDATE catalogue_settings SET value=$1 WHERE key='catalogue_url'",[URL]);
    console.log('catalogue_url updated: '+r.rowCount+' row(s) affected');
    const r2=await p.query("SELECT value FROM catalogue_settings WHERE key='catalogue_url'");
    console.log('New value: '+r2.rows[0].value);
  }catch(e){
    console.error('ERR: '+e.message);
  }
  await p.end();
})();
