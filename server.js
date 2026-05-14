const express=require('express');
require('dotenv').config();
const initRapportAuto = require('./rapport-auto');
const cors=require('cors');
const {Pool}=require('pg');
const multer=require('multer');
const path=require('path');
const fs=require('fs');

const app=express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* Config base de données depuis .env */

const pool=new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'shop_db',
  password: process.env.DB_PASSWORD || 'Sempac',
  port:     Number(process.env.DB_PORT) || 5432
});

const uploadDir=path.join(__dirname,'uploads');
if(!fs.existsSync(uploadDir))fs.mkdirSync(uploadDir);
app.use('/uploads',express.static(uploadDir));

const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadDir),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.round(Math.random()*1e6)+path.extname(file.originalname))
});
const upload=multer({storage,limits:{fileSize:20*1024*1024},
  fileFilter:(req,file,cb)=>{
    const allowed=['.pdf','.jpg','.jpeg','.png','.docx','.doc','.pptx','.ppt','.xlsx','.xls','.txt','.odt','.odp','.ods'];
    cb(null,allowed.includes(path.extname(file.originalname).toLowerCase()));
  }});

/* =======================================================
   PRODUCTS — spécifiques AVANT /:id
======================================================= */
app.get('/api/products',async(req,res)=>{
  try{const r=await pool.query(`SELECT id,name,category,condition,color,grade,location_zone,location_detail,stock_alert,sale_price AS price,sale_price,purchase_price,stock_quantity,barcode,supplier_id,supplier_name FROM products ORDER BY name ASC`);res.json(r.rows);}
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/products/alerts',async(req,res)=>{
  try{const r=await pool.query(`SELECT id,name,category,stock_quantity,stock_alert FROM products WHERE stock_quantity<=stock_alert AND category!='Prestation' ORDER BY stock_quantity ASC`);res.json(r.rows);}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/products/quick',async(req,res)=>{
  try{const{name,category,condition,color,grade,location_zone,location_detail,supplier_name,purchase_price,sale_price,stock_quantity,stock_alert}=req.body;
    const r=await pool.query(`INSERT INTO products(name,category,condition,color,grade,location_zone,location_detail,supplier_name,purchase_price,sale_price,stock_quantity,stock_alert) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name,category||'Autre',condition||'NEUF',color||null,grade||null,location_zone||null,location_detail||null,supplier_name||null,Number(purchase_price||0),Number(sale_price||0),Number(stock_quantity||1),Number(stock_alert||3)]);
    res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/products/:id',async(req,res)=>{
  try{const{name,category,condition,color,grade,location_zone,location_detail,barcode,supplier_name,purchase_price,sale_price,stock_quantity,stock_alert}=req.body;
    const r=await pool.query(`UPDATE products SET name=$1,category=$2,condition=$3,color=$4,grade=$5,location_zone=$6,location_detail=$7,barcode=$8,supplier_name=$9,purchase_price=$10,sale_price=$11,stock_quantity=$12,stock_alert=$13 WHERE id=$14 RETURNING *`,
      [name,category||'Autre',condition||'NEUF',color||null,grade||null,location_zone||null,location_detail||null,barcode||null,supplier_name||null,Number(purchase_price||0),Number(sale_price||0),Number(stock_quantity||0),Number(stock_alert||3),req.params.id]);
    res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/products/:id',async(req,res)=>{
  try{await pool.query(`DELETE FROM products WHERE id=$1`,[req.params.id]);res.json({success:true});}
  catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   ORDERS — /search AVANT /:id
======================================================= */
app.post('/api/orders',async(req,res)=>{
  const client=await pool.connect();
  try{
    const{cart,payment,customer,comment,garantie,amount_cb,amount_cash,amount_credit}=req.body;
    if(!cart||!cart.length)return res.status(400).json({success:false,error:'Panier vide'});
    const total=cart.reduce((s,i)=>s+(Number(i.price)*Number(i.qty))-(Number(i.discount||0)*Number(i.qty)),0);
    const cb=Number(amount_cb||0),cash=Number(amount_cash||0),credit=Number(amount_credit||0);
    let pm=payment||'cash';if(!['card','cash','mixed','credit'].includes(pm))pm='cash';
    await client.query('BEGIN');
    const or=await client.query(`INSERT INTO orders(total,payment_method,customer_name,comment,status,amount_cb,amount_cash,amount_credit,garantie,created_at) VALUES($1,$2,$3,$4,'completed',$5,$6,$7,$8,NOW()) RETURNING id`,
      [total.toFixed(2),pm,customer||'',comment||'',cb,cash,credit,garantie||null]);
    const orderId=or.rows[0].id;
    for(const item of cart){
      await client.query(`INSERT INTO order_items(order_id,product_id,quantity,price,discount) VALUES($1,$2,$3,$4,$5)`,[orderId,item.id,item.qty,Number(item.price),Number(item.discount||0)]);
      await client.query(`UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2`,[item.qty,item.id]);
      /* Mise à jour lot si produit vient d'un lot */
      const li=await client.query(`SELECT id FROM lot_items WHERE product_id=$1 AND status NOT IN ('VENDU','IRREPARABLE') ORDER BY id DESC LIMIT 1`,[item.id]);
      if(li.rows.length>0){
        await client.query(`UPDATE lot_items SET status='VENDU',sale_price=$1,order_id=$2,updated_at=NOW() WHERE id=$3`,
          [Number(item.price)-Number(item.discount||0),orderId,li.rows[0].id]);
      }
    }
    if(credit>0){await client.query(`INSERT INTO customer_credits(customer_name,phone,order_id,total_amount,amount_paid,amount_due,status,notes) VALUES($1,$2,$3,$4,$5,$6,'EN_COURS',$7)`,
      [customer||'Anonyme','',orderId,total.toFixed(2),(cb+cash).toFixed(2),credit.toFixed(2),comment||'']);}
    await client.query('COMMIT');res.json({success:true,orderId});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({success:false,error:e.message});}
  finally{client.release();}
});
app.get('/api/orders/search',async(req,res)=>{
  try{const{date_min,date_max,id,payment,customer}=req.query;
    let q=`SELECT * FROM orders WHERE 1=1`;const p=[];
    if(id){p.push(id);q+=` AND id=$${p.length}`;}
    if(date_min){p.push(date_min);q+=` AND DATE(created_at)>=$${p.length}`;}
    if(date_max){p.push(date_max);q+=` AND DATE(created_at)<=$${p.length}`;}
    if(payment){p.push(payment);q+=` AND payment_method=$${p.length}`;}
    if(customer){p.push('%'+customer+'%');q+=` AND customer_name ILIKE $${p.length}`;}
    q+=` ORDER BY id DESC LIMIT 200`;
    const r=await pool.query(q,p);res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/orders/:id',async(req,res)=>{
  try{const order=await pool.query(`SELECT * FROM orders WHERE id=$1`,[req.params.id]);
    const items=await pool.query(`SELECT oi.*,p.name FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1 ORDER BY oi.id`,[req.params.id]);
    res.json({order:order.rows[0],items:items.rows});
  }catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/orders/:id',async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');
    await client.query(`UPDATE products p SET stock_quantity=stock_quantity+oi.quantity FROM order_items oi WHERE oi.order_id=$1 AND p.id=oi.product_id`,[req.params.id]);
    await client.query(`DELETE FROM customer_credits WHERE order_id=$1`,[req.params.id]);
    await client.query(`DELETE FROM order_items WHERE order_id=$1`,[req.params.id]);
    await client.query(`DELETE FROM orders WHERE id=$1`,[req.params.id]);
    await client.query('COMMIT');res.json({success:true});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* =======================================================
   DAILY REPORT
======================================================= */
app.get('/api/daily-report',async(req,res)=>{
  try{const date=req.query.date||new Date().toISOString().split('T')[0];
    const ventes=await pool.query(`
      SELECT o.id,o.payment_method,o.total,
        CASE WHEN COALESCE(o.amount_cb,0)>0 OR COALESCE(o.amount_cash,0)>0 THEN COALESCE(o.amount_cb,0) WHEN o.payment_method='card' THEN o.total ELSE 0 END AS amount_cb,
        CASE WHEN COALESCE(o.amount_cb,0)>0 OR COALESCE(o.amount_cash,0)>0 THEN COALESCE(o.amount_cash,0) WHEN o.payment_method='cash' THEN o.total ELSE 0 END AS amount_cash,
        COALESCE(o.amount_credit,0) AS amount_credit,
        CASE WHEN COALESCE(o.amount_cb,0)>0 OR COALESCE(o.amount_cash,0)>0 THEN COALESCE(o.amount_cb,0)+COALESCE(o.amount_cash,0) WHEN o.payment_method IN ('card','cash','mixed') THEN o.total ELSE 0 END AS encaisse,
        o.comment,STRING_AGG(DISTINCT p.name,', ') AS designation
      FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id
      WHERE DATE(o.created_at)=$1 AND (o.status IS NULL OR o.status!='cancelled') AND o.payment_method!='credit'
      GROUP BY o.id ORDER BY o.id DESC`,[date]);
    const reps=await pool.query(`
      SELECT id,TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')||' '||COALESCE(device_type,'')) AS designation,
        payment_method,COALESCE(final_price,estimated_price,0) AS total,
        COALESCE(amount_cb,CASE WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END) AS amount_cb,
        COALESCE(amount_cash,CASE WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END) AS amount_cash,
        COALESCE(amount_credit,0) AS amount_credit
      FROM repairs WHERE DATE(created_at)=$1 AND status IN ('TERMINE','LIVRE') ORDER BY id DESC`,[date]);
    const totV=await pool.query(`
      SELECT COUNT(*) AS nb_ventes,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0) WHEN payment_method='card' THEN total ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cash,0) WHEN payment_method='cash' THEN total ELSE 0 END),0) AS total_esp,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0)+COALESCE(amount_cash,0) WHEN payment_method IN ('card','cash','mixed') THEN total ELSE 0 END),0) AS total_encaisse,
        COALESCE(SUM(COALESCE(amount_credit,0)),0) AS total_credit
      FROM orders WHERE DATE(created_at)=$1 AND (status IS NULL OR status!='cancelled') AND payment_method!='credit'`,[date]);
    const totR=await pool.query(`
      SELECT COUNT(*) AS nb_reps,COALESCE(SUM(COALESCE(final_price,estimated_price,0)),0) AS grand_total,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 THEN amount_cb WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cash,0)>0 THEN amount_cash WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_esp
      FROM repairs WHERE DATE(created_at)=$1 AND status IN ('TERMINE','LIVRE')`,[date]);
    const totDep=await pool.query(`SELECT COALESCE(SUM(amount),0) AS total_depenses FROM expenses WHERE DATE(date)=$1`,[date]);
    res.json({date,ventes:ventes.rows,reparations:reps.rows,totaux_ventes:totV.rows[0],totaux_reparations:totR.rows[0],total_depenses:parseFloat(totDep.rows[0].total_depenses)});
  }catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   RAPPORT COMPTABLE
======================================================= */
app.get('/api/rapport-comptable',async(req,res)=>{
  try{const date=req.query.date||new Date().toISOString().split('T')[0];
    const ventes=await pool.query(`
      SELECT p.name AS nom, COALESCE(p.supplier_name,'—') AS fournisseur,
        oi.quantity AS qty, oi.price AS prix_unit,
        (oi.price*oi.quantity)-(COALESCE(oi.discount,0)*oi.quantity) AS total_ligne,
        o.payment_method, o.id AS order_id
      FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id
      WHERE DATE(o.created_at)=$1 AND (o.status IS NULL OR o.status!='cancelled') AND o.payment_method!='credit'
      ORDER BY o.id DESC,oi.id ASC`,[date]);
    const reps=await pool.query(`
      SELECT TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')||' '||COALESCE(device_type,'')) AS nom,
        1 AS qty,COALESCE(final_price,estimated_price,0) AS total_ligne,payment_method
      FROM repairs WHERE DATE(created_at)=$1 AND status IN ('TERMINE','LIVRE') ORDER BY id DESC`,[date]);
    const totVentes=await pool.query(`
      SELECT COALESCE(SUM((oi.price*oi.quantity)-(COALESCE(oi.discount,0)*oi.quantity)),0) AS total_ventes
      FROM orders o JOIN order_items oi ON oi.order_id=o.id
      WHERE DATE(o.created_at)=$1 AND (o.status IS NULL OR o.status!='cancelled') AND o.payment_method!='credit'`,[date]);
    const totVPay=await pool.query(`
      SELECT
        COALESCE(SUM(CASE
          WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0)
          WHEN payment_method='card' THEN total ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE
          WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cash,0)
          WHEN payment_method='cash' THEN total ELSE 0 END),0) AS total_esp
      FROM orders
      WHERE DATE(created_at)=$1 AND (status IS NULL OR status!='cancelled') AND payment_method!='credit'`,[date]);
    const totV={rows:[{
      total_ventes: totVentes.rows[0].total_ventes,
      total_cb:     totVPay.rows[0].total_cb,
      total_esp:    totVPay.rows[0].total_esp
    }]};
    const totR=await pool.query(`
      SELECT COALESCE(SUM(COALESCE(final_price,estimated_price,0)),0) AS total_reps,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 THEN amount_cb WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cash,0)>0 THEN amount_cash WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_esp
      FROM repairs WHERE DATE(created_at)=$1 AND status IN ('TERMINE','LIVRE')`,[date]);
    const totDep=await pool.query(`SELECT COALESCE(SUM(amount),0) AS total_depenses FROM expenses WHERE DATE(date)=$1`,[date]);
    res.json({date,ventes:ventes.rows,reps:reps.rows,totaux:{
      total_ventes:parseFloat(totV.rows[0].total_ventes),total_reps:parseFloat(totR.rows[0].total_reps),
      total_cb:parseFloat(totV.rows[0].total_cb)+parseFloat(totR.rows[0].total_cb),
      total_esp:parseFloat(totV.rows[0].total_esp)+parseFloat(totR.rows[0].total_esp),
      total_dep:parseFloat(totDep.rows[0].total_depenses)}});
  }catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   REPAIRS — /search AVANT /:id
======================================================= */
app.get('/api/repairs',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM repairs ORDER BY id DESC`);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/repairs/search',async(req,res)=>{try{const q=req.query.q||'';const r=await pool.query(`SELECT * FROM repairs WHERE CAST(id AS TEXT) ILIKE $1 OR customer_name ILIKE $1 OR phone ILIKE $1 OR brand ILIKE $1 OR model ILIKE $1 ORDER BY id DESC LIMIT 100`,[`%${q}%`]);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/repairs/:id',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM repairs WHERE id=$1`,[req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/repairs',async(req,res)=>{try{const r=await pool.query(`INSERT INTO repairs(customer_name,phone,device_type,brand,model,serial_number,issue,estimated_price,comment,garantie,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'EN_ATTENTE',NOW()) RETURNING *`,
  [req.body.customer_name||'',req.body.phone||'',req.body.device_type||'',req.body.brand||'',req.body.model||'',req.body.serial_number||'',req.body.issue||'',Number(req.body.estimated_price||0),req.body.comment||'',req.body.garantie||null]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/repairs/:id',async(req,res)=>{
  const client=await pool.connect();
  try{
    const status=String(req.body.status||'EN_ATTENTE');
    const fp=Number(req.body.final_price||0);
    const ep=Number(req.body.estimated_price||0);
    const cb=Number(req.body.amount_cb||0),cash=Number(req.body.amount_cash||0),credit=Number(req.body.amount_credit||0);
    const{customer_name,phone,device_type,brand,model,serial_number,issue,comment}=req.body;
    let pm='cash';if(cb>0&&cash>0)pm='mixed';else if(cb>0)pm='card';else if(cash>0)pm='cash';else if(credit>0)pm='credit';
    await client.query('BEGIN');
    const r=await client.query(`UPDATE repairs SET
      status=CAST($1 AS varchar),final_price=$2,
      estimated_price=CASE WHEN $3>0 THEN $3 ELSE estimated_price END,
      customer_name=CASE WHEN $4!='' THEN $4 ELSE customer_name END,
      phone=CASE WHEN $5!='' THEN $5 ELSE phone END,
      device_type=CASE WHEN $6!='' THEN $6 ELSE device_type END,
      brand=CASE WHEN $7!='' THEN $7 ELSE brand END,
      model=CASE WHEN $8!='' THEN $8 ELSE model END,
      serial_number=CASE WHEN $9!='' THEN $9 ELSE serial_number END,
      issue=CASE WHEN $10!='' THEN $10 ELSE issue END,
      comment=$11,payment_method=$12,amount_cb=$13,amount_cash=$14,amount_credit=$15,
      updated_at=NOW(),
      delivered_at=CASE WHEN CAST($1 AS varchar)='TERMINE' THEN NOW() ELSE delivered_at END
      WHERE id=$16 RETURNING *`,
      [status,fp,ep,customer_name||'',phone||'',device_type||'',brand||'',model||'',serial_number||'',issue||'',comment||'',pm,cb,cash,credit,req.params.id]);
    if(credit>0){const rep=r.rows[0];const ex=await client.query(`SELECT id FROM customer_credits WHERE repair_id=$1`,[req.params.id]);
      if(ex.rows.length===0){await client.query(`INSERT INTO customer_credits(customer_name,phone,repair_id,total_amount,amount_paid,amount_due,status) VALUES($1,$2,$3,$4,$5,$6,'EN_COURS')`,
        [rep.customer_name||'Anonyme',rep.phone||'',req.params.id,fp,(cb+cash).toFixed(2),credit.toFixed(2)]);}
      else{await client.query(`UPDATE customer_credits SET amount_paid=$1,amount_due=$2,status=CASE WHEN $2<=0 THEN 'SOLDE' ELSE status END,updated_at=NOW() WHERE repair_id=$3`,
        [(cb+cash).toFixed(2),credit.toFixed(2),req.params.id]);}}
    await client.query('COMMIT');res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});
app.delete('/api/repairs/:id',async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');await client.query(`DELETE FROM customer_credits WHERE repair_id=$1`,[req.params.id]);await client.query(`DELETE FROM repairs WHERE id=$1`,[req.params.id]);await client.query('COMMIT');res.json({success:true});}
  catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});

/* =======================================================
   EXPENSES
======================================================= */
app.get('/api/expenses',async(req,res)=>{try{const{from='2000-01-01',to='2999-12-31',category}=req.query;let q=`SELECT * FROM expenses WHERE DATE(date) BETWEEN $1 AND $2`;const p=[from,to];if(category){q+=` AND category=$3`;p.push(category);}q+=` ORDER BY date DESC`;const r=await pool.query(q,p);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/expenses',async(req,res)=>{try{const{description,amount,category,date}=req.body;const r=await pool.query(`INSERT INTO expenses(description,amount,category,date) VALUES($1,$2,$3,$4) RETURNING *`,[description||'',Number(amount||0),category||'Autre',date||new Date().toISOString().split('T')[0]]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/expenses/:id',async(req,res)=>{try{await pool.query(`DELETE FROM expenses WHERE id=$1`,[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});

/* =======================================================
   CREDITS — /search AVANT /:id
======================================================= */
app.get('/api/credits',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM customer_credits WHERE status=$1 ORDER BY created_at DESC`,[req.query.status||'EN_COURS']);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/credits/search',async(req,res)=>{try{const q=req.query.q||'';const r=await pool.query(`SELECT * FROM customer_credits WHERE customer_name ILIKE $1 OR phone ILIKE $1 ORDER BY created_at DESC`,[`%${q}%`]);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/credits/:id/pay',async(req,res)=>{
  const client=await pool.connect();
  try{const{amount,payment_method,notes}=req.body;
    await client.query('BEGIN');
    await client.query(`INSERT INTO credit_payments(credit_id,amount,payment_method,notes) VALUES($1,$2,$3,$4)`,[req.params.id,Number(amount),payment_method||'cash',notes||'']);
    const r=await client.query(`UPDATE customer_credits SET amount_paid=amount_paid+$1,amount_due=amount_due-$1,status=CASE WHEN (amount_due-$1)<=0 THEN 'SOLDE' ELSE status END,updated_at=NOW() WHERE id=$2 RETURNING *`,[Number(amount),req.params.id]);
    await client.query('COMMIT');res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});

/* =======================================================
   RETOURS
======================================================= */
app.get('/api/returns/store',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM returns_store ORDER BY created_at DESC`);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/returns/store',async(req,res)=>{try{const{order_id,customer_name,phone,reason,refund_method,refund_amount,items,notes}=req.body;const r=await pool.query(`INSERT INTO returns_store(order_id,customer_name,phone,reason,refund_method,refund_amount,items,notes,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'EN_ATTENTE') RETURNING *`,[order_id||null,customer_name||'',phone||'',reason||'',refund_method||'cash',Number(refund_amount||0),JSON.stringify(items||[]),notes||'']);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/returns/store/:id',async(req,res)=>{try{const r=await pool.query(`UPDATE returns_store SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[req.body.status,req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/returns/supplier',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM returns_supplier ORDER BY created_at DESC`);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/returns/supplier',async(req,res)=>{try{const{supplier_name,product_name,quantity,reason,refund_amount,tracking_number,notes}=req.body;const r=await pool.query(`INSERT INTO returns_supplier(supplier_name,product_name,quantity,reason,refund_amount,tracking_number,notes,status) VALUES($1,$2,$3,$4,$5,$6,$7,'EN_ATTENTE') RETURNING *`,[supplier_name||'',product_name||'',Number(quantity||1),reason||'',Number(refund_amount||0),tracking_number||'',notes||'']);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/returns/supplier/:id',async(req,res)=>{try{const r=await pool.query(`UPDATE returns_supplier SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,[req.body.status,req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});

/* =======================================================
   STOCK INUTILISABLE
======================================================= */
app.get('/api/stock/damaged',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM stock_damaged ORDER BY created_at DESC`);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/stock/damaged',async(req,res)=>{try{const{product_id,product_name,quantity,reason,responsible,cost_value}=req.body;const r=await pool.query(`INSERT INTO stock_damaged(product_id,product_name,quantity,reason,responsible,cost_value) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[product_id||null,product_name||'',Number(quantity||1),reason||'',responsible||'',Number(cost_value||0)]);if(product_id)await pool.query(`UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2`,[Number(quantity||1),product_id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});

/* =======================================================
   IMPRESSION
======================================================= */
app.post('/api/print/upload',upload.single('file'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'Aucun fichier reçu'});const{copies=1,color_mode='bw'}=req.body;const r=await pool.query(`INSERT INTO print_queue(filename,filepath,filetype,filesize,copies,color_mode,status) VALUES($1,$2,$3,$4,$5,$6,'EN_ATTENTE') RETURNING *`,[req.file.originalname,'uploads/'+req.file.filename,path.extname(req.file.originalname).replace('.',''),req.file.size,Number(copies),color_mode]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/print/queue',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM print_queue ORDER BY uploaded_at DESC LIMIT 50`);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/print/:id/done',async(req,res)=>{try{const r=await pool.query(`UPDATE print_queue SET status='IMPRIME',printed_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/print/:id/cancel',async(req,res)=>{try{const r=await pool.query(`UPDATE print_queue SET status='ANNULE' WHERE id=$1 RETURNING *`,[req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});

/* =======================================================
   LOTS — /costs et /items AVANT /:id
======================================================= */
app.get('/api/lots',async(req,res)=>{
  try{const r=await pool.query(`
    SELECT l.*,COUNT(li.id) AS nb_appareils,
      COUNT(CASE WHEN li.status='VENDU' THEN 1 END) AS nb_vendus,
      COUNT(CASE WHEN li.status='EN_STOCK' THEN 1 END) AS nb_stock,
      COUNT(CASE WHEN li.status='EN_TEST' THEN 1 END) AS nb_test,
      COUNT(CASE WHEN li.status='EN_REPARATION' THEN 1 END) AS nb_reparation,
      COUNT(CASE WHEN li.status='IRREPARABLE' THEN 1 END) AS nb_irreparable,
      COALESCE(SUM(li.sale_price),0) AS total_ventes,
      COALESCE((SELECT SUM(lc.amount) FROM lot_costs lc WHERE lc.lot_id=l.id),0) AS total_couts_sup
    FROM lots l LEFT JOIN lot_items li ON li.lot_id=l.id
    GROUP BY l.id ORDER BY l.created_at DESC`);
  res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/lots',async(req,res)=>{
  const client=await pool.connect();
  try{const{name,supplier_name,supplier_phone,purchase_date,total_cost,amount_cb,amount_cash,amount_credit,notes}=req.body;
    const cost=Number(total_cost||0),cb=Number(amount_cb||0),cash=Number(amount_cash||0),credit=Number(amount_credit||0);
    const pdate=purchase_date||new Date().toISOString().split('T')[0];
    await client.query('BEGIN');
    const r=await client.query(`INSERT INTO lots(name,supplier_name,supplier_phone,purchase_date,total_cost,amount_cb,amount_cash,amount_credit,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name,supplier_name||'',supplier_phone||null,pdate,cost,cb,cash,credit,notes||'']);
    const lot=r.rows[0];
    let expenseId=null;
    if(cost>0){const exp=await client.query(`INSERT INTO expenses(description,amount,category,date) VALUES($1,$2,'Fournisseur',$3) RETURNING id`,
      [`Achat lot: ${name} — ${supplier_name||''}`,cost,pdate]);
      expenseId=exp.rows[0].id;await client.query(`UPDATE lots SET expense_id=$1 WHERE id=$2`,[expenseId,lot.id]);}
    if(credit>0){await client.query(`INSERT INTO customer_credits(customer_name,phone,total_amount,amount_paid,amount_due,status,notes) VALUES($1,$2,$3,$4,$5,'EN_COURS',$6)`,
      [supplier_name||'Fournisseur',supplier_phone||'',cost,(cb+cash).toFixed(2),credit.toFixed(2),`Reste à payer lot: ${name}`]);}
    await client.query('COMMIT');res.json({...lot,expense_id:expenseId});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});
app.delete('/api/lots/costs/:id',async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');
    const cost=await client.query(`SELECT * FROM lot_costs WHERE id=$1`,[req.params.id]);
    if(cost.rows[0]?.product_id&&cost.rows[0]?.cost_type==='piece'){
      await client.query(`UPDATE products SET stock_quantity=stock_quantity+$1 WHERE id=$2`,[cost.rows[0].quantity,cost.rows[0].product_id]);}
    await client.query(`DELETE FROM lot_costs WHERE id=$1`,[req.params.id]);
    await client.query('COMMIT');res.json({success:true});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});
app.put('/api/lots/items/:id',async(req,res)=>{
  const client=await pool.connect();
  try{const{status,sale_price,notes,order_id,repair_id}=req.body;
    await client.query('BEGIN');
    const old=await client.query(`SELECT * FROM lot_items WHERE id=$1`,[req.params.id]);
    const oldStatus=old.rows[0]?.status||'EN_TEST';
    const r=await client.query(`UPDATE lot_items SET status=$1,
      sale_price=CASE WHEN $2::numeric IS NOT NULL THEN $2::numeric ELSE sale_price END,
      notes=CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE notes END,
      order_id=CASE WHEN $4::int IS NOT NULL THEN $4::int ELSE order_id END,
      repair_id=CASE WHEN $5::int IS NOT NULL THEN $5::int ELSE repair_id END,
      updated_at=NOW() WHERE id=$6 RETURNING *`,
      [status,sale_price!=null?Number(sale_price):null,notes!=null?notes:null,order_id||null,repair_id||null,req.params.id]);
    const item=r.rows[0];
    if(item.product_id){
      if(status==='EN_STOCK'&&oldStatus!=='EN_STOCK')await client.query(`UPDATE products SET stock_quantity=GREATEST(stock_quantity,1) WHERE id=$1`,[item.product_id]);
      if(status==='IRREPARABLE'&&oldStatus!=='IRREPARABLE')await client.query(`UPDATE products SET stock_quantity=GREATEST(0,stock_quantity-1) WHERE id=$1`,[item.product_id]);
      if(status==='VENDU'&&oldStatus!=='VENDU')await client.query(`UPDATE products SET stock_quantity=GREATEST(0,stock_quantity-1) WHERE id=$1`,[item.product_id]);
      if(oldStatus==='EN_STOCK'&&(status==='EN_REPARATION'||status==='EN_TEST'))await client.query(`UPDATE products SET stock_quantity=GREATEST(0,stock_quantity-1) WHERE id=$1`,[item.product_id]);
    }
    await client.query('COMMIT');res.json(item);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});
app.get('/api/lots/:id',async(req,res)=>{
  try{const lot=await pool.query(`SELECT * FROM lots WHERE id=$1`,[req.params.id]);
    const items=await pool.query(`SELECT li.*,p.name AS product_name,o.total AS order_total FROM lot_items li LEFT JOIN products p ON p.id=li.product_id LEFT JOIN orders o ON o.id=li.order_id WHERE li.lot_id=$1 ORDER BY li.id ASC`,[req.params.id]);
    const costs=await pool.query(`SELECT lc.*,p.name AS product_name FROM lot_costs lc LEFT JOIN products p ON p.id=lc.product_id WHERE lc.lot_id=$1 ORDER BY lc.created_at ASC`,[req.params.id]);
    res.json({lot:lot.rows[0],items:items.rows,costs:costs.rows});
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/lots/:id',async(req,res)=>{
  const client=await pool.connect();
  try{const{name,supplier_name,supplier_phone,purchase_date,total_cost,amount_cb,amount_cash,amount_credit,notes,status}=req.body;
    const cost=Number(total_cost||0),cb=Number(amount_cb||0),cash=Number(amount_cash||0),credit=Number(amount_credit||0);
    await client.query('BEGIN');
    const r=await client.query(`UPDATE lots SET name=$1,supplier_name=$2,supplier_phone=$3,purchase_date=$4,total_cost=$5,amount_cb=$6,amount_cash=$7,amount_credit=$8,notes=$9,status=$10 WHERE id=$11 RETURNING *`,
      [name,supplier_name||'',supplier_phone||null,purchase_date,cost,cb,cash,credit,notes||'',status||'EN_COURS',req.params.id]);
    const lot=r.rows[0];
    if(lot.expense_id&&cost>0)await client.query(`UPDATE expenses SET description=$1,amount=$2,date=$3 WHERE id=$4`,
      [`Achat lot: ${name} — ${supplier_name||''}`,cost,purchase_date,lot.expense_id]);
    else if(!lot.expense_id&&cost>0){const exp=await client.query(`INSERT INTO expenses(description,amount,category,date) VALUES($1,$2,'Fournisseur',$3) RETURNING id`,
      [`Achat lot: ${name} — ${supplier_name||''}`,cost,purchase_date]);
      await client.query(`UPDATE lots SET expense_id=$1 WHERE id=$2`,[exp.rows[0].id,lot.id]);}
    await client.query('COMMIT');res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});
app.delete('/api/lots/:id',async(req,res)=>{try{await pool.query(`DELETE FROM lots WHERE id=$1`,[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/lots/:id/items',async(req,res)=>{
  const client=await pool.connect();
  try{const{product_id,name,category,color,grade,supplier_name,purchase_price,sale_price,notes}=req.body;
    await client.query('BEGIN');
    if(product_id){
      const prod=await client.query(`SELECT * FROM products WHERE id=$1`,[product_id]);
      if(!prod.rows[0])throw new Error('Produit introuvable');
      const p=prod.rows[0];
      const item=await client.query(`INSERT INTO lot_items(lot_id,name,purchase_price,status,product_id,notes) VALUES($1,$2,$3,'EN_TEST',$4,$5) RETURNING *`,
        [req.params.id,p.name,Number(purchase_price||0),product_id,notes||'']);
      await client.query(`UPDATE products SET stock_quantity=stock_quantity+1 WHERE id=$1`,[product_id]);
      if(sale_price&&Number(sale_price)>0)await client.query(`UPDATE products SET sale_price=$1 WHERE id=$2`,[Number(sale_price),product_id]);
      await client.query('COMMIT');res.json({...item.rows[0],product_id});
    }else{
      if(!name)throw new Error('Nom obligatoire');
      const prod=await client.query(`INSERT INTO products(name,category,condition,color,grade,supplier_name,purchase_price,sale_price,stock_quantity,stock_alert) VALUES($1,$2,'OCCASION',$3,$4,$5,$6,$7,1,1) RETURNING *`,
        [name,category||'Smartphone',color||null,grade||null,supplier_name||null,Number(purchase_price||0),Number(sale_price||0)]);
      const productId=prod.rows[0].id;
      const item=await client.query(`INSERT INTO lot_items(lot_id,name,purchase_price,status,product_id,notes) VALUES($1,$2,$3,'EN_TEST',$4,$5) RETURNING *`,
        [req.params.id,name,Number(purchase_price||0),productId,notes||'']);
      await client.query('COMMIT');res.json({...item.rows[0],product_id:productId});
    }
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});
app.post('/api/lots/:id/costs',async(req,res)=>{
  const client=await pool.connect();
  try{const{lot_item_id,description,amount,cost_type,repair_type,product_id,quantity}=req.body;
    await client.query('BEGIN');
    const r=await client.query(`INSERT INTO lot_costs(lot_id,lot_item_id,description,amount,cost_type,repair_type,product_id,quantity) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id,lot_item_id||null,description,Number(amount||0),cost_type||'piece',repair_type||'interne',product_id||null,Number(quantity||1)]);
    if(product_id&&cost_type==='piece')await client.query(`UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2 AND stock_quantity>=$1`,[Number(quantity||1),product_id]);
    await client.query('COMMIT');res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}finally{client.release();}
});

/* =======================================================
   CONTACTS — CRUD complet
======================================================= */
app.get('/api/contacts',async(req,res)=>{
  try{const{category,q}=req.query;
    let sql=`SELECT * FROM contacts WHERE 1=1`;const p=[];
    if(category){p.push(category);sql+=` AND category=$${p.length}`;}
    if(q){p.push(`%${q}%`);const n=p.length;sql+=` AND (name ILIKE $${n} OR company ILIKE $${n} OR phone ILIKE $${n} OR email ILIKE $${n})`;}
    sql+=` ORDER BY is_favorite DESC,category ASC,name ASC`;
    const r=await pool.query(sql,p);res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/contacts',async(req,res)=>{
  try{const{category,name,company,phone,phone2,email,whatsapp,address,notes,is_favorite}=req.body;
    if(!name)return res.status(400).json({error:'Nom obligatoire'});
    const r=await pool.query(`INSERT INTO contacts(category,name,company,phone,phone2,email,whatsapp,address,notes,is_favorite) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [category||'Autre',name,company||null,phone||null,phone2||null,email||null,whatsapp||null,address||null,notes||null,is_favorite||false]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/contacts/:id',async(req,res)=>{
  try{const{category,name,company,phone,phone2,email,whatsapp,address,notes,is_favorite}=req.body;
    const r=await pool.query(`UPDATE contacts SET category=$1,name=$2,company=$3,phone=$4,phone2=$5,email=$6,whatsapp=$7,address=$8,notes=$9,is_favorite=$10,updated_at=NOW() WHERE id=$11 RETURNING *`,
      [category||'Autre',name,company||null,phone||null,phone2||null,email||null,whatsapp||null,address||null,notes||null,is_favorite||false,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/contacts/:id',async(req,res)=>{
  try{await pool.query(`DELETE FROM contacts WHERE id=$1`,[req.params.id]);res.json({success:true});}
  catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   SUPPLIERS CATALOG
======================================================= */
app.get('/api/suppliers-catalog', async(req,res)=>{
  try{
    const r = await pool.query('SELECT * FROM suppliers_catalog WHERE is_active=true ORDER BY rating DESC, name ASC');
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/suppliers-catalog', async(req,res)=>{
  try{
    const{name,website,search_url,logo_emoji,specialty,delivery,rating,notes}=req.body;
    const r = await pool.query(
      `INSERT INTO suppliers_catalog(name,website,search_url,logo_emoji,specialty,delivery,rating,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name,website||null,search_url||null,logo_emoji||'🏭',specialty||null,delivery||null,Number(rating||5),notes||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/suppliers-catalog/:id', async(req,res)=>{
  try{
    const{name,website,search_url,logo_emoji,specialty,delivery,rating,notes,is_active}=req.body;
    const r = await pool.query(
      `UPDATE suppliers_catalog SET name=$1,website=$2,search_url=$3,logo_emoji=$4,
       specialty=$5,delivery=$6,rating=$7,notes=$8,is_active=$9 WHERE id=$10 RETURNING *`,
      [name,website||null,search_url||null,logo_emoji||'🏭',specialty||null,
       delivery||null,Number(rating||5),notes||null,is_active!==false,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/suppliers-catalog/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM suppliers_catalog WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

/* Prix par produit */
app.get('/api/supplier-prices', async(req,res)=>{
  try{
    const q = req.query.product || '';
    const r = await pool.query(
      `SELECT sp.*,sc.name AS supplier_name,sc.logo_emoji,sc.delivery,sc.website
       FROM supplier_prices sp
       JOIN suppliers_catalog sc ON sc.id=sp.supplier_id
       WHERE sp.product_name ILIKE $1
       ORDER BY sp.price ASC NULLS LAST`,
      ['%'+q+'%']);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/supplier-prices', async(req,res)=>{
  try{
    const{product_name,product_id,supplier_id,price,quality_type,quality_rating,in_stock,url,notes}=req.body;
    const r = await pool.query(
      `INSERT INTO supplier_prices(product_name,product_id,supplier_id,price,quality_type,quality_rating,in_stock,url,notes,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *`,
      [product_name,product_id||null,supplier_id,Number(price||0),quality_type||null,
       Number(quality_rating||3),in_stock!==false,url||null,notes||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/supplier-prices/:id', async(req,res)=>{
  try{
    const{price,quality_type,quality_rating,in_stock,url,notes}=req.body;
    const r = await pool.query(
      `UPDATE supplier_prices SET price=$1,quality_type=$2,quality_rating=$3,
       in_stock=$4,url=$5,notes=$6,updated_at=NOW() WHERE id=$7 RETURNING *`,
      [Number(price||0),quality_type||null,Number(quality_rating||3),
       in_stock!==false,url||null,notes||null,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/supplier-prices/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM supplier_prices WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

/* Confirmation impression client (après scan QR) */
app.post('/api/print/:id/confirm', async(req,res)=>{
  try{
    const{copies,color_mode}=req.body;
    const r=await pool.query(
      `UPDATE print_queue SET copies=$1,color_mode=$2,status='EN_ATTENTE',updated_at=NOW() WHERE id=$3 RETURNING *`,
      [Number(copies||1),color_mode||'bw',req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Travail introuvable ou expiré'});
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});


/* =======================================================
   USERS & AUTH
======================================================= */
app.get('/api/users', async(req,res)=>{
  try{
    const r=await pool.query(
      `SELECT id,name,role,auth_type,is_active FROM app_users WHERE is_active=true ORDER BY role DESC,name ASC`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/auth/login', async(req,res)=>{
  try{
    const{user_id,type,value}=req.body;
    const r=await pool.query(`SELECT * FROM app_users WHERE id=$1 AND is_active=true`,[user_id]);
    if(!r.rows[0])return res.status(401).json({error:'Utilisateur introuvable'});
    const user=r.rows[0];
    let ok=false;
    if(type==='pin'){
      ok=(user.pin===value);
    } else {
      ok=(user.password_hash===value); /* Simple pour l'instant — à hasher en prod */
    }
    if(!ok)return res.status(401).json({error:'Invalid credentials'});
    res.json({user:{id:user.id,name:user.name,role:user.role,auth_type:user.auth_type}});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/users/:id', async(req,res)=>{
  try{
    const r=await pool.query(`SELECT id,name,role,auth_type,is_active FROM app_users WHERE id=$1`,[req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/users', async(req,res)=>{
  try{
    const{name,role,auth_type,pin,password_hash}=req.body;
    const r=await pool.query(
      `INSERT INTO app_users(name,role,auth_type,pin,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,name,role,auth_type`,
      [name,role||'vendeur',auth_type||'pin',pin||null,password_hash||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/users/:id', async(req,res)=>{
  try{
    const{name,role,auth_type,pin,password_hash,is_active}=req.body;
    const r=await pool.query(
      `UPDATE app_users SET name=$1,role=$2,auth_type=$3,pin=$4,password_hash=$5,is_active=$6,updated_at=NOW() WHERE id=$7 RETURNING id,name,role,auth_type,is_active`,
      [name,role,auth_type,pin||null,password_hash||null,is_active!==false,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/users/:id', async(req,res)=>{
  try{
    await pool.query(`UPDATE app_users SET is_active=false WHERE id=$1`,[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

/* Catégories dépenses autorisées */
app.get('/api/expense-categories', async(req,res)=>{
  try{
    const role=req.query.role||'gerant';
    const r=await pool.query(
      `SELECT category FROM expense_categories_config WHERE allowed_roles LIKE $1 ORDER BY category`,
      ['%'+role+'%']);
    res.json(r.rows.map(r=>r.category));
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/expense-categories/all', async(req,res)=>{
  try{
    const r=await pool.query(`SELECT * FROM expense_categories_config ORDER BY category`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/expense-categories/:category', async(req,res)=>{
  try{
    const{allowed_roles}=req.body;
    const r=await pool.query(
      `INSERT INTO expense_categories_config(category,allowed_roles) VALUES($1,$2)
       ON CONFLICT(category) DO UPDATE SET allowed_roles=$2 RETURNING *`,
      [req.params.category,allowed_roles]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/expense-categories', async(req,res)=>{
  try{
    const{category,allowed_roles}=req.body;
    const r=await pool.query(
      `INSERT INTO expense_categories_config(category,allowed_roles) VALUES($1,$2) RETURNING *`,
      [category,allowed_roles||'gerant']);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/expense-categories/:category', async(req,res)=>{
  try{
    await pool.query(`DELETE FROM expense_categories_config WHERE category=$1`,[req.params.category]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});


/* ══ RAPPORT AUTOMATIQUE ══ */
const envoyerRapport = initRapportAuto(pool);

/* Route pour tester manuellement */
app.post('/api/rapport/envoyer', async(req,res)=>{
  try{
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await envoyerRapport(pool, date);
    res.json(result);
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/rapport/test', async(req,res)=>{
  try{
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const result = await envoyerRapport(pool, date);
    res.json(result);
  }catch(e){res.status(500).json({error:e.message});}
});


/* =======================================================
   COMPARATEUR PRIX REPARATIONS
======================================================= */
app.get('/api/repair-competitors', async(req,res)=>{
  try{
    const r=await pool.query('SELECT * FROM repair_competitors WHERE is_active=true ORDER BY name ASC');
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/repair-competitors', async(req,res)=>{
  try{
    const{name,website,search_url,logo_emoji,zone,notes}=req.body;
    const r=await pool.query(
      'INSERT INTO repair_competitors(name,website,search_url,logo_emoji,zone,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [name,website||null,search_url||null,logo_emoji||'🔧',zone||'National',notes||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/repair-competitors/:id', async(req,res)=>{
  try{
    const{name,website,search_url,logo_emoji,zone,notes,is_active}=req.body;
    const r=await pool.query(
      'UPDATE repair_competitors SET name=$1,website=$2,search_url=$3,logo_emoji=$4,zone=$5,notes=$6,is_active=$7 WHERE id=$8 RETURNING *',
      [name,website||null,search_url||null,logo_emoji||'🔧',zone||'National',notes||null,is_active!==false,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/repair-competitors/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM repair_competitors WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/repair-prices', async(req,res)=>{
  try{
    const{brand,model,type}=req.query;
    let sql='SELECT rp.*,rc.name AS competitor_name,rc.logo_emoji,rc.zone FROM repair_prices rp JOIN repair_competitors rc ON rc.id=rp.competitor_id WHERE 1=1';
    const p=[];
    if(brand){p.push('%'+brand+'%');sql+=' AND rp.device_brand ILIKE $'+p.length;}
    if(model){p.push('%'+model+'%');sql+=' AND rp.device_model ILIKE $'+p.length;}
    if(type) {p.push('%'+type+'%'); sql+=' AND rp.repair_type ILIKE $'+p.length;}
    sql+=' ORDER BY rp.price ASC NULLS LAST';
    const r=await pool.query(sql,p);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/repair-prices', async(req,res)=>{
  try{
    const{device_brand,device_model,repair_type,competitor_id,price,delay,quality_rating,notes}=req.body;
    const r=await pool.query(
      'INSERT INTO repair_prices(device_brand,device_model,repair_type,competitor_id,price,delay,quality_rating,notes,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *',
      [device_brand,device_model,repair_type,competitor_id,Number(price||0),delay||null,Number(quality_rating||3),notes||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/repair-prices/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM repair_prices WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});


/* =======================================================
   DEVIS
======================================================= */
app.get('/api/devis', async(req,res)=>{
  try{
    const r=await pool.query(`
      SELECT d.*, 
        COALESCE(json_agg(di ORDER BY di.id) FILTER (WHERE di.id IS NOT NULL), '[]') AS items
      FROM devis d
      LEFT JOIN devis_items di ON di.devis_id=d.id
      GROUP BY d.id ORDER BY d.created_at DESC`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/devis', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{customer_name,phone,email,validite,notes,items}=req.body;
    const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const numRes=await client.query("SELECT next_numero('DEV',$1,'devis','numero_dev') AS num",[dateStr]);
    const numDev=numRes.rows[0].num;
    const total=(items||[]).reduce((s,i)=>(s+(Number(i.price)*Number(i.quantity||1))-(Number(i.discount||0)*Number(i.quantity||1))),0);
    await client.query('BEGIN');
    const d=await client.query(
      `INSERT INTO devis(numero_dev,customer_name,phone,email,validite,notes,total) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [numDev,customer_name||'',phone||null,email||null,Number(validite||30),notes||null,total.toFixed(2)]);
    const devisId=d.rows[0].id;
    for(const it of (items||[])){
      await client.query(
        `INSERT INTO devis_items(devis_id,description,quantity,price,discount) VALUES($1,$2,$3,$4,$5)`,
        [devisId,it.description,Number(it.quantity||1),Number(it.price||0),Number(it.discount||0)]);
    }
    await client.query('COMMIT');
    res.json(d.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

app.put('/api/devis/:id', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{customer_name,phone,email,validite,notes,status,items}=req.body;
    const total=(items||[]).reduce((s,i)=>(s+(Number(i.price)*Number(i.quantity||1))-(Number(i.discount||0)*Number(i.quantity||1))),0);
    await client.query('BEGIN');
    const d=await client.query(
      `UPDATE devis SET customer_name=$1,phone=$2,email=$3,validite=$4,notes=$5,status=$6,total=$7,updated_at=NOW() WHERE id=$8 RETURNING *`,
      [customer_name||'',phone||null,email||null,Number(validite||30),notes||null,status||'EN_ATTENTE',total.toFixed(2),req.params.id]);
    await client.query(`DELETE FROM devis_items WHERE devis_id=$1`,[req.params.id]);
    for(const it of (items||[])){
      await client.query(
        `INSERT INTO devis_items(devis_id,description,quantity,price,discount) VALUES($1,$2,$3,$4,$5)`,
        [req.params.id,it.description,Number(it.quantity||1),Number(it.price||0),Number(it.discount||0)]);
    }
    await client.query('COMMIT');
    res.json(d.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* Convertir devis en vente */
app.post('/api/devis/:id/convert-order', async(req,res)=>{
  const client=await pool.connect();
  try{
    const d=await client.query(`SELECT d.*,json_agg(di ORDER BY di.id) AS items FROM devis d JOIN devis_items di ON di.devis_id=d.id WHERE d.id=$1 GROUP BY d.id`,[req.params.id]);
    if(!d.rows[0])return res.status(404).json({error:'Devis introuvable'});
    const dev=d.rows[0];
    await client.query('BEGIN');
    const or=await client.query(
      `INSERT INTO orders(total,payment_method,customer_name,comment,status,created_at) VALUES($1,'card',$2,$3,'completed',NOW()) RETURNING id`,
      [dev.total,dev.customer_name,'Converti depuis '+dev.numero_dev]);
    await client.query(`UPDATE devis SET status='CONVERTI',converted_to='order',converted_id=$1,updated_at=NOW() WHERE id=$2`,[or.rows[0].id,req.params.id]);
    await client.query('COMMIT');
    res.json({order_id:or.rows[0].id});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* Convertir devis en réparation */
app.post('/api/devis/:id/convert-repair', async(req,res)=>{
  const client=await pool.connect();
  try{
    const d=await client.query(`SELECT * FROM devis WHERE id=$1`,[req.params.id]);
    if(!d.rows[0])return res.status(404).json({error:'Devis introuvable'});
    const dev=d.rows[0];
    await client.query('BEGIN');
    const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const numRes=await client.query("SELECT next_numero('REP',$1,'repairs','numero_rep') AS num",[dateStr]);
    const r=await client.query(
      `INSERT INTO repairs(customer_name,phone,estimated_price,comment,numero_rep,status,created_at) VALUES($1,$2,$3,$4,$5,'EN_ATTENTE',NOW()) RETURNING id`,
      [dev.customer_name,dev.phone,dev.total,'Converti depuis '+dev.numero_dev,numRes.rows[0].num]);
    await client.query(`UPDATE devis SET status='CONVERTI',converted_to='repair',converted_id=$1,updated_at=NOW() WHERE id=$2`,[r.rows[0].id,req.params.id]);
    await client.query('COMMIT');
    res.json({repair_id:r.rows[0].id});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

app.delete('/api/devis/:id', async(req,res)=>{
  try{
    await pool.query(`DELETE FROM devis WHERE id=$1`,[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});


/* =======================================================
   MODIFIER UNE VENTE
======================================================= */
app.put('/api/orders/:id', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{customer_name,comment,garantie,payment_method,amount_cb,amount_cash,amount_credit,items}=req.body;
    await client.query('BEGIN');

    /* Récupérer les anciens items pour ajuster le stock */
    const oldItems=await client.query('SELECT * FROM order_items WHERE order_id=$1',[req.params.id]);

    /* Remettre l'ancien stock */
    for(const oi of oldItems.rows){
      await client.query('UPDATE products SET stock_quantity=stock_quantity+$1 WHERE id=$2',[oi.quantity,oi.product_id]);
    }

    /* Supprimer les anciens items */
    await client.query('DELETE FROM order_items WHERE order_id=$1',[req.params.id]);

    /* Recalculer le total */
    const total=(items||[]).reduce((s,it)=>(s+(Number(it.price)*Number(it.qty||it.quantity||1))-(Number(it.discount||0)*Number(it.qty||it.quantity||1))),0);

    /* Déterminer le mode de paiement */
    const cb=Number(amount_cb||0),cash=Number(amount_cash||0),credit=Number(amount_credit||0);
    let pm=payment_method||'cash';
    if(cb>0&&cash>0)pm='mixed';
    else if(cb>0)pm='card';
    else if(cash>0)pm='cash';
    else if(credit>0)pm='credit';

    /* Mettre à jour la commande */
    const r=await client.query(
      `UPDATE orders SET customer_name=$1,comment=$2,garantie=$3,payment_method=$4,
       amount_cb=$5,amount_cash=$6,amount_credit=$7,total=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [customer_name||'',comment||null,garantie||null,pm,cb,cash,credit,total.toFixed(2),req.params.id]);

    /* Réinsérer les nouveaux items et décrémenter le stock */
    for(const it of (items||[])){
      await client.query(
        'INSERT INTO order_items(order_id,product_id,quantity,price,discount) VALUES($1,$2,$3,$4,$5)',
        [req.params.id,it.product_id||it.id,Number(it.qty||it.quantity||1),Number(it.price),Number(it.discount||0)]);
      await client.query(
        'UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2',
        [Number(it.qty||it.quantity||1),it.product_id||it.id]);
    }

    await client.query('COMMIT');
    res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

app.listen(3000,()=>console.log('🚀 The SMARTPHONE POS — http://localhost:3000'));