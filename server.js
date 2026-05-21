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
  try{const r=await pool.query(`SELECT p.id,p.name,p.category,p.condition,p.color,p.grade,p.location_zone,p.location_detail,p.stock_alert,p.sale_price AS price,p.sale_price,p.purchase_price,p.stock_quantity,p.barcode,p.supplier_id,p.supplier_name,p.statut_produit,p.type_entree,p.lot_id,p.imei,p.numero_serie,p.notes,p.client_rachat_nom,p.client_rachat_tel,l.name AS lot_name FROM products p LEFT JOIN lots l ON l.id=p.lot_id ORDER BY p.name ASC`);res.json(r.rows);}
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
    const{cart,payment,customer,comment,garantie,amount_cb,amount_cash,amount_credit,sale_date}=req.body;
    if(!cart||!cart.length)return res.status(400).json({success:false,error:'Panier vide'});
    const total=cart.reduce((s,i)=>s+(Number(i.price)*Number(i.qty))-(Number(i.discount||0)*Number(i.qty)),0);
    const cb=Number(amount_cb||0),cash=Number(amount_cash||0),credit=Number(amount_credit||0);
    let pm=payment||'cash';if(!['card','cash','mixed','credit'].includes(pm))pm='cash';
    await client.query('BEGIN');
    const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const numRes=await client.query("SELECT next_numero('VNT',$1,'orders','numero') AS num",[dateStr]);
    const numero=numRes.rows[0].num;
    const orderDate = sale_date ? new Date(sale_date) : new Date();
    const or=await client.query(`INSERT INTO orders(numero,total,payment_method,customer_name,comment,status,amount_cb,amount_cash,amount_credit,garantie,created_at) VALUES($1,$2,$3,$4,$5,'completed',$6,$7,$8,$9,$10) RETURNING id`,
      [numero,total.toFixed(2),pm,customer||'',comment||'',cb,cash,credit,garantie||null,orderDate]);
    const orderId=or.rows[0].id;
    for(const item of cart){
      await client.query(`INSERT INTO order_items(order_id,product_id,quantity,price,discount) VALUES($1,$2,$3,$4,$5)`,[orderId,item.id,item.qty,Number(item.price),Number(item.discount||0)]);
      await client.query(`UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2`,[item.qty,item.id]);
      /* Mettre à jour statut produit si vendu depuis stock */
      if(item.product_id || item.id){
        const pid = item.product_id || item.id;
        await client.query(
          'UPDATE products SET statut_produit=$1,sale_price=$2,updated_at=NOW() WHERE id=$3 AND statut_produit!=\'VENDU\'',
          ['VENDU', Number(item.price)-Number(item.discount||0), pid]);
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
        COALESCE(SUM(total),0) AS grand_total,
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
app.get('/api/repairs/search',async(req,res)=>{
  try{
    const q=req.query.q||'';
    const{date_min,date_max,status,brand,model,issue,price_min,price_max}=req.query;
    let sql='SELECT * FROM repairs WHERE 1=1';
    const params=[];
    if(q){
      params.push('%'+q+'%');
      const n=params.length;
      sql+=` AND (CAST(id AS TEXT) ILIKE $${n} OR customer_name ILIKE $${n} OR phone ILIKE $${n} OR brand ILIKE $${n} OR model ILIKE $${n} OR COALESCE(numero_rep,'') ILIKE $${n})`;
    }
    if(date_min){params.push(date_min);sql+=` AND DATE(created_at)>=$${params.length}`;}
    if(date_max){params.push(date_max);sql+=` AND DATE(created_at)<=$${params.length}`;}
    if(status){params.push(status);sql+=` AND status=$${params.length}`;}
    if(brand){params.push('%'+brand+'%');sql+=` AND brand ILIKE $${params.length}`;}
    if(model){params.push('%'+model+'%');sql+=` AND model ILIKE $${params.length}`;}
    if(issue){params.push('%'+issue+'%');sql+=` AND issue ILIKE $${params.length}`;}
    if(price_min){params.push(Number(price_min));sql+=` AND COALESCE(final_price,estimated_price,0)>=$${params.length}`;}
    if(price_max){params.push(Number(price_max));sql+=` AND COALESCE(final_price,estimated_price,0)<=$${params.length}`;}
    sql+=' ORDER BY id DESC LIMIT 200';
    const r=await pool.query(sql,params);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/repairs/:id',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM repairs WHERE id=$1`,[req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/repairs',async(req,res)=>{
  try{
    const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const numRes=await pool.query("SELECT next_numero('REP',$1,'repairs','numero_rep') AS num",[dateStr]);
    const numero=numRes.rows[0].num;
    const r=await pool.query(
      `INSERT INTO repairs(numero_rep,customer_name,phone,device_type,brand,model,
        serial_number,issue,estimated_price,comment,garantie,status,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'EN_ATTENTE',NOW()) RETURNING *`,
      [numero,req.body.customer_name||'',req.body.phone||'',req.body.device_type||'',
       req.body.brand||'',req.body.model||'',req.body.serial_number||'',
       req.body.issue||'',Number(req.body.estimated_price||0),
       req.body.comment||'',req.body.garantie||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/repairs/:id',async(req,res)=>{
  const client=await pool.connect();
  try{
    const status=String(req.body.status||'EN_ATTENTE');
    const repair_date=req.body.repair_date||null;
    const fp=Number(req.body.final_price||0);
    const ep=Number(req.body.estimated_price||0);
    const cb=Number(req.body.amount_cb||0),cash=Number(req.body.amount_cash||0),credit=Number(req.body.amount_credit||0);
    const{customer_name,phone,device_type,brand,model,serial_number,issue,comment}=req.body;
    let pm='cash';if(cb>0&&cash>0)pm='mixed';else if(cb>0)pm='card';else if(cash>0)pm='cash';else if(credit>0)pm='credit';
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
      created_at=COALESCE(CASE WHEN $17::text IS NOT NULL THEN $17::timestamp ELSE NULL END,created_at),
      delivered_at=CASE WHEN CAST($1 AS varchar)='TERMINE' THEN NOW() ELSE delivered_at END
      WHERE id=$16 RETURNING *`,
      [status,fp,ep,customer_name||'',phone||'',device_type||'',brand||'',model||'',serial_number||'',issue||'',comment||'',pm,cb,cash,credit,req.params.id,repair_date||null]);
    if(credit>0){const rep=r.rows[0];const ex=await client.query(`SELECT id FROM customer_credits WHERE repair_id=$1`,[req.params.id]);
      if(ex.rows.length===0){await client.query(`INSERT INTO customer_credits(customer_name,phone,repair_id,total_amount,amount_paid,amount_due,status) VALUES($1,$2,$3,$4,$5,$6,'EN_COURS')`,
        [rep.customer_name||'Anonyme',rep.phone||'',req.params.id,fp,(cb+cash).toFixed(2),credit.toFixed(2)]);}
      else{await client.query(`UPDATE customer_credits SET amount_paid=$1,amount_due=$2,status=CASE WHEN $2<=0 THEN 'SOLDE' ELSE 'EN_COURS' END WHERE repair_id=$3`,
        [(cb+cash).toFixed(2),credit.toFixed(2),req.params.id]);}
    }
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
app.put('/api/expenses/:id', async(req,res)=>{
  try{
    const{description,amount,amount_ht,amount_ttc,taux_tva,category,date}=req.body;
    const tva=Number(taux_tva||20);
    const ttc=amount_ttc?Number(amount_ttc):Number(amount||0);
    const ht=amount_ht?Number(amount_ht):(tva>0?ttc/(1+tva/100):ttc);
    const r=await pool.query(
      `UPDATE expenses SET description=$1,amount=$2,amount_ht=$3,amount_ttc=$4,
       taux_tva=$5,category=$6,date=$7 WHERE id=$8 RETURNING *`,
      [description||'',ttc,Number(ht.toFixed(2)),Number(ttc.toFixed(2)),
       tva,category||'Autre',date||new Date().toISOString().split('T')[0],req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/expenses/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM expenses WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/expenses',async(req,res)=>{
  try{
    const{description,amount,amount_ht,amount_ttc,taux_tva,category,date}=req.body;
    const dateStr=(date||new Date().toISOString().slice(0,10)).replace(/-/g,'');
    const numRes=await pool.query("SELECT next_numero('DEP',$1,'expenses','numero') AS num",[dateStr]);
    const numero=numRes.rows[0].num;
    /* Calcul HT/TTC automatique si non fourni */
    const tva=Number(taux_tva||20);
    const ht=amount_ht?Number(amount_ht):Number(amount||0)/(1+tva/100);
    const ttc=amount_ttc?Number(amount_ttc):Number(amount||0);
    const r=await pool.query(
      `INSERT INTO expenses(numero,description,amount,amount_ht,amount_ttc,taux_tva,category,date)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [numero,description||'',Number(amount||ttc),Number(ht.toFixed(2)),Number(ttc.toFixed(2)),tva,
       category||'Autre',date||new Date().toISOString().split('T')[0]]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
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
    SELECT l.*,(SELECT COUNT(*) FROM products WHERE lot_id=l.id) AS nb_appareils,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='VENDU') AS nb_vendus,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='DISPONIBLE') AS nb_stock,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='EN_TEST') AS nb_test,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='REPARATION') AS nb_reparation,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='IRREPARABLE') AS nb_irreparable,
      (SELECT COALESCE(SUM(sale_price),0) FROM products WHERE lot_id=l.id AND statut_produit='VENDU') AS total_ventes,
      COALESCE((SELECT SUM(lc.amount) FROM lot_costs lc WHERE lc.lot_id=l.id),0) AS total_couts_sup
    FROM lots l
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
/* Route PUT lot_items supprimée */
app.get('/api/lots/:id',async(req,res)=>{
  try{const lot=await pool.query(`
    SELECT l.*,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id) AS nb_appareils,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='VENDU') AS nb_vendus,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='DISPONIBLE') AS nb_stock,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='EN_TEST') AS nb_test,
      (SELECT COUNT(*) FROM products WHERE lot_id=l.id AND statut_produit='REPARATION') AS nb_reparation,
      (SELECT COALESCE(SUM(sale_price),0) FROM products WHERE lot_id=l.id AND statut_produit='VENDU') AS total_ventes
    FROM lots l WHERE l.id=$1`,[req.params.id]);
    const items={rows:[]}; /* lot_items supprimée - tout est dans products */
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
/* Route lot_items supprimée: /* Route POST lot_items supprimée */


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
    const{customer_name,comment,garantie,payment_method,amount_cb,amount_cash,amount_credit,items,sale_date}=req.body;
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
       amount_cb=$5,amount_cash=$6,amount_credit=$7,total=$8,updated_at=NOW(),
       created_at=COALESCE($10,created_at)
       WHERE id=$9 RETURNING *`,
      [customer_name||'',comment||null,garantie||null,pm,cb,cash,credit,total.toFixed(2),req.params.id,sale_date?new Date(sale_date):null]);

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


/* ── LOT ITEMS ── */
/* Route lot_items supprimée: app.get('/api/lot-items/:id' */


/* Route lot_items supprimée: app.put('/api/lot-items/:id' */



/* =======================================================
   MODULE COMMANDES FOURNISSEURS
======================================================= */

/* ── GET toutes les commandes ── */
app.get('/api/commandes', async(req,res)=>{
  try{
    const{statut,fournisseur}=req.query;
    let sql=`SELECT c.*,
      COUNT(ci.id) AS nb_items,
      SUM(ci.quantite_cmd) AS total_qty_cmd,
      COALESCE(SUM(ci."quantite_reçue"),0) AS total_qty_recu
      FROM commandes c
      LEFT JOIN commande_items ci ON ci.commande_id=c.id
      WHERE 1=1`;
    const p=[];
    if(statut){p.push(statut);sql+=` AND c.statut=$${p.length}`;}
    if(fournisseur){p.push('%'+fournisseur+'%');sql+=` AND c.fournisseur ILIKE $${p.length}`;}
    sql+=' GROUP BY c.id ORDER BY c.created_at DESC';
    const r=await pool.query(sql,p);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── GET alertes commandes ── */
app.get('/api/commandes/alertes', async(req,res)=>{
  try{
    /* Commandes en attente depuis plus de 1 jour */
    const r=await pool.query(`
      SELECT c.*,
        EXTRACT(DAY FROM NOW()-c.created_at) AS jours_attente
      FROM commandes c
      WHERE c.statut IN ('EN_ATTENTE','PARTIELLEMENT_RECU')
        AND c.created_at < NOW() - INTERVAL '1 day'
      ORDER BY c.created_at ASC`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── GET une commande avec ses items ── */
app.get('/api/commandes/:id', async(req,res)=>{
  try{
    const c=await pool.query('SELECT * FROM commandes WHERE id=$1',[req.params.id]);
    if(!c.rows[0])return res.status(404).json({error:'Commande introuvable'});
    const items=await pool.query('SELECT * FROM commande_items WHERE commande_id=$1 ORDER BY id',[req.params.id]);
    res.json({commande:c.rows[0],items:items.rows});
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── POST créer une commande ── */
app.post('/api/commandes', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{fournisseur,fournisseur_id,origine,date_commande,date_facture,date_livraison_prevue,
          notes,paiement,montant_ht,montant_ttc,numero_facture,fichier_pdf,
          transporteur,created_by,items}=req.body;
    const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const numRes=await client.query("SELECT next_numero('CMD',$1,'commandes','numero') AS num",[dateStr]);
    const numero=numRes.rows[0].num;
    console.log('CMD import:', {fournisseur,numero_facture,montant_ht,montant_ttc});
    await client.query('BEGIN');
    const cmd=await client.query(
      `INSERT INTO commandes(numero,fournisseur,fournisseur_id,origine,date_commande,
        date_facture,date_livraison_prevue,notes,paiement,montant_ht,montant_ttc,
        numero_facture,fichier_pdf,transporteur,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [numero,fournisseur,fournisseur_id||null,origine||'MANUEL',
       date_commande||new Date().toISOString().slice(0,10),
       date_facture||null,date_livraison_prevue||null,
       notes||null,paiement||'card',
       Number(montant_ht||0),Number(montant_ttc||0),
       numero_facture||null,fichier_pdf||null,
       transporteur||null,created_by||null]);
    const cmdId=cmd.rows[0].id;
    for(const it of (items||[])){
      await client.query(
        `INSERT INTO commande_items(commande_id,reference,nom,categorie,
          quantite_cmd,prix_ht,prix_ttc,prix_vente,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cmdId,it.reference||null,it.nom,it.categorie||'Pièce détachée',
         Number(it.quantite_cmd||1),Number(it.prix_ht||0),
         Number(it.prix_ttc||0),Number(it.prix_vente||0),it.notes||null]);
    }
    await client.query('COMMIT');
    res.json(cmd.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* ── PUT modifier une commande ── */
app.put('/api/commandes/:id', async(req,res)=>{
  try{
    const{statut,date_livraison,notes,numero_facture,fichier_pdf,transporteur}=req.body;
    const r=await pool.query(
      `UPDATE commandes SET statut=COALESCE($1,statut),
        date_livraison_prevue=COALESCE($2::date,date_livraison_prevue),
        notes=COALESCE($3,notes),
        numero_facture=COALESCE($4,numero_facture),
        fichier_pdf=COALESCE($5,fichier_pdf),
        transporteur=COALESCE($7,transporteur),
        updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [statut||null,date_livraison||null,notes||null,
       numero_facture||null,fichier_pdf||null,req.params.id,transporteur||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── PUT réception partielle/totale ── */
app.put('/api/commandes/:id/reception', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{items}=req.body; // [{id, "quantite_reçue", prix_vente, categorie}]
    await client.query('BEGIN');
    let totalRecu=0, totalCmd=0;
    for(const it of items){
      await client.query(
        `UPDATE commande_items SET "quantite_reçue"=$1,prix_vente=$2,
          statut=CASE WHEN $1>=quantite_cmd THEN 'RECU'
                      WHEN $1>0 THEN 'PARTIEL'
                      ELSE 'MANQUANT' END
         WHERE id=$3`,
        [Number(it.quantite_reçue||0),Number(it.prix_vente||0),it.id]);
      /* Ajouter au stock si reçu */
      if(Number(it.quantite_reçue)>0){
        /* Chercher si produit existe déjà */
        const existing=await client.query(
          'SELECT id FROM products WHERE name ILIKE $1 LIMIT 1',
          ['%'+it.nom+'%']);
        if(existing.rows[0]){
          await client.query(
            'UPDATE products SET stock_quantity=stock_quantity+$1 WHERE id=$2',
            [Number(it.quantite_reçue),existing.rows[0].id]);
        } else {
          await client.query(
            `INSERT INTO products(name,category,condition,purchase_price,sale_price,
              stock_quantity,stock_alert,supplier_name)
             VALUES($1,$2,'NEUF',$3,$4,$5,3,$6)`,
            [it.nom,it.categorie||'Pièce détachée',
             Number(it.prix_ht||0),Number(it.prix_vente||0),
             Number(it.quantite_reçue),it.fournisseur||null]);
        }
        totalRecu+=Number(it.quantite_reçue);
      }
      totalCmd+=Number(it.quantite_cmd||1);
    }
    /* Mettre à jour statut commande */
    const statut=totalRecu===0?'EN_ATTENTE':
                 totalRecu>=totalCmd?'RECU':'PARTIELLEMENT_RECU';
    await client.query(
      `UPDATE commandes SET statut=$1,date_livraison=CURRENT_DATE,updated_at=NOW() WHERE id=$2`,
      [statut,req.params.id]);
    await client.query('COMMIT');
    res.json({success:true,statut});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* ── POST extraction PDF via Claude ── */
app.post('/api/commandes/extract-pdf', async(req,res)=>{
  try{
    const{pdfBase64,filename}=req.body;
    if(!pdfBase64)return res.status(400).json({error:'PDF manquant'});

    const Anthropic=require('@anthropic-ai/sdk');
    const anthropic=new Anthropic();

    const response=await anthropic.messages.create({
      model:'claude-sonnet-4-20250514',
      max_tokens:2000,
      messages:[{
        role:'user',
        content:[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:pdfBase64}},
          {type:'text',text:`Extrais les informations de cette facture fournisseur et retourne UNIQUEMENT un JSON valide sans texte avant/après :
{
  "fournisseur": "nom du fournisseur",
  "numero_facture": "numéro de facture",
  "date_facture": "YYYY-MM-DD",
  "montant_ht": 0.00,
  "montant_ttc": 0.00,
  "paiement": "card ou cash",
  "items": [
    {
      "reference": "ref produit",
      "nom": "nom du produit",
      "quantite_cmd": 1,
      "prix_ht": 0.00,
      "prix_ttc": 0.00,
      "categorie": "Pièce détachée ou Smartphone ou Accessoire ou Accessoire Info"
    }
  ]
}`}
        ]
      }]
    });

    const text=response.content.map(b=>b.type==='text'?b.text:'').join('');
    const clean=text.replace(/\`\`\`json|\`\`\`/g,'').trim();
    const data=JSON.parse(clean);
    res.json(data);
  }catch(e){
    console.error('Extract PDF error:',e.message);
    res.status(500).json({error:e.message});
  }
});

/* ── GET besoins technicien ── */
app.get('/api/besoins', async(req,res)=>{
  try{
    const r=await pool.query('SELECT * FROM besoins_technicien ORDER BY urgence DESC,created_at DESC');
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/besoins', async(req,res)=>{
  try{
    const{nom,categorie,quantite,urgence,notes,created_by}=req.body;
    const r=await pool.query(
      `INSERT INTO besoins_technicien(nom,categorie,quantite,urgence,notes,created_by)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nom,categorie||'Pièce détachée',Number(quantite||1),
       urgence||'NORMAL',notes||null,created_by||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/besoins/:id', async(req,res)=>{
  try{
    const{statut,commande_id}=req.body;
    const r=await pool.query(
      'UPDATE besoins_technicien SET statut=$1,commande_id=$2 WHERE id=$3 RETURNING *',
      [statut||'EN_ATTENTE',commande_id||null,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/besoins/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM besoins_technicien WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});



/* =======================================================
   STOCK V2 — Nouveaux champs + codes barres multiples
======================================================= */

/* ── GET tous les produits avec barcodes ── */
app.get('/api/products/full', async(req,res)=>{
  try{
    const r = await pool.query(`
      SELECT p.*,
        COALESCE(json_agg(pb.*) FILTER (WHERE pb.id IS NOT NULL), '[]') AS barcodes
      FROM products p
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id
      GROUP BY p.id
      ORDER BY p.name ASC`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── POST créer produit complet ── */
app.post('/api/products/full', async(req,res)=>{
  const client = await pool.connect();
  try{
    const{name,category,condition,color,grade,location_zone,location_detail,
          supplier_name,purchase_price,sale_price,stock_quantity,stock_alert,
          imei,numero_serie,statut_produit,type_entree,lot_id,commande_id,
          client_rachat_nom,client_rachat_tel,notes,barcodes}=req.body;
    console.log('DEBUG POST products/full lot_id:', lot_id, 'type:', typeof lot_id);
    await client.query('BEGIN');
    const r = await client.query(`
      INSERT INTO products(name,category,condition,color,grade,location_zone,
        location_detail,supplier_name,purchase_price,sale_price,stock_quantity,
        stock_alert,imei,numero_serie,statut_produit,type_entree,lot_id,
        commande_id,client_rachat_nom,client_rachat_tel,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [name,category||'Smartphone',condition||'NEUF',color||null,grade||null,
       location_zone||null,location_detail||null,supplier_name||null,
       Number(purchase_price||0),Number(sale_price||0),
       Number(stock_quantity||1),Number(stock_alert||3),
       imei||null,numero_serie||null,statut_produit||'DISPONIBLE',
       type_entree||'ACHAT_DIRECT',lot_id||null,commande_id||null,
       client_rachat_nom||null,client_rachat_tel||null,notes||null]);
    const pid = r.rows[0].id;
    /* Insérer les codes barres */
    for(const bc of (barcodes||[])){
      if(bc.barcode){
        await client.query(
          'INSERT INTO product_barcodes(product_id,barcode,fournisseur,notes) VALUES($1,$2,$3,$4)',
          [pid,bc.barcode,bc.fournisseur||null,bc.notes||null]);
      }
    }
    await client.query('COMMIT');
    res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* ── PUT modifier produit complet ── */
app.put('/api/products/full/:id', async(req,res)=>{
  const client = await pool.connect();
  try{
    const{name,category,condition,color,grade,location_zone,location_detail,
          supplier_name,purchase_price,sale_price,stock_quantity,stock_alert,
          imei,numero_serie,statut_produit,type_entree,lot_id,commande_id,
          client_rachat_nom,client_rachat_tel,notes,barcodes}=req.body;
    await client.query('BEGIN');
    /* Récupérer le lot_id existant si non fourni */
    const existing = await client.query('SELECT lot_id FROM products WHERE id=$1',[req.params.id]);
    const existingLotId = existing.rows[0]?.lot_id;
    const finalLotId = lot_id !== undefined && lot_id !== null ? lot_id : existingLotId;
    const r = await client.query(`
      UPDATE products SET
        name=$1,category=$2,condition=$3,color=$4,grade=$5,
        location_zone=$6,location_detail=$7,supplier_name=$8,
        purchase_price=$9,sale_price=$10,stock_quantity=$11,stock_alert=$12,
        imei=$13,numero_serie=$14,statut_produit=$15,type_entree=$16,
        lot_id=$17,commande_id=$18,client_rachat_nom=$19,client_rachat_tel=$20,
        notes=$21,updated_at=NOW()
      WHERE id=$22 RETURNING *`,
      [name,category||'Smartphone',condition||'NEUF',color||null,grade||null,
       location_zone||null,location_detail||null,supplier_name||null,
       Number(purchase_price||0),Number(sale_price||0),
       Number(stock_quantity||1),Number(stock_alert||3),
       imei||null,numero_serie||null,statut_produit||'DISPONIBLE',
       type_entree||'ACHAT_DIRECT',finalLotId||null,commande_id||null,
       client_rachat_nom||null,client_rachat_tel||null,notes||null,
       req.params.id]);
    /* Remplacer les codes barres */
    await client.query('DELETE FROM product_barcodes WHERE product_id=$1',[req.params.id]);
    for(const bc of (barcodes||[])){
      if(bc.barcode){
        await client.query(
          'INSERT INTO product_barcodes(product_id,barcode,fournisseur,notes) VALUES($1,$2,$3,$4)',
          [req.params.id,bc.barcode,bc.fournisseur||null,bc.notes||null]);
      }
    }
    await client.query('COMMIT');
    res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* ── PUT statut produit ── */
app.put('/api/products/:id/statut', async(req,res)=>{
  try{
    const{statut_produit,sale_price}=req.body;
    let sql='UPDATE products SET statut_produit=$1,updated_at=NOW()';
    const params=[statut_produit,req.params.id];
    if(sale_price!==undefined){
      sql+=',sale_price=$3';
      params.splice(1,0,Number(sale_price));
    }
    sql+=' WHERE id=$'+(params.length)+' RETURNING *';
    /* Réindexer */
    const finalParams=[statut_produit];
    if(sale_price!==undefined) finalParams.push(Number(sale_price));
    finalParams.push(req.params.id);
    const finalSql=sale_price!==undefined
      ?'UPDATE products SET statut_produit=$1,sale_price=$2,updated_at=NOW() WHERE id=$3 RETURNING *'
      :'UPDATE products SET statut_produit=$1,updated_at=NOW() WHERE id=$2 RETURNING *';
    const r=await pool.query(finalSql,finalParams);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── GET produits par statut ── */
app.get('/api/products/statut/:statut', async(req,res)=>{
  try{
    const r=await pool.query(
      'SELECT * FROM products WHERE statut_produit=$1 ORDER BY name',
      [req.params.statut]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── GET barcodes d'un produit ── */
app.get('/api/products/:id/barcodes', async(req,res)=>{
  try{
    const r=await pool.query(
      'SELECT * FROM product_barcodes WHERE product_id=$1 ORDER BY id',
      [req.params.id]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── POST ajouter un barcode ── */
app.post('/api/products/:id/barcodes', async(req,res)=>{
  try{
    const{barcode,fournisseur,notes}=req.body;
    const r=await pool.query(
      'INSERT INTO product_barcodes(product_id,barcode,fournisseur,notes) VALUES($1,$2,$3,$4) RETURNING *',
      [req.params.id,barcode,fournisseur||null,notes||null]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── DELETE barcode ── */
app.delete('/api/barcodes/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM product_barcodes WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── Recherche par barcode (tous les codes) ── */
app.get('/api/products/search-barcode/:code', async(req,res)=>{
  try{
    const r=await pool.query(`
      SELECT p.* FROM products p
      WHERE UPPER(p.barcode)=UPPER($1) OR UPPER(p.imei)=UPPER($1)
      UNION
      SELECT p.* FROM products p
      JOIN product_barcodes pb ON pb.product_id=p.id
      WHERE UPPER(pb.barcode)=UPPER($1)
      LIMIT 5`,[req.params.code]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── Import CSV produits ── */
app.post('/api/products/import-csv', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{rows}=req.body; // Array of product objects
    await client.query('BEGIN');
    var imported=0, errors=[];
    for(var i=0;i<rows.length;i++){
      var row=rows[i];
      if(!row.name||!row.category||!row.prix_vente){
        errors.push({line:i+2,error:'Champs obligatoires manquants (nom, categorie, prix_vente)'});
        continue;
      }
      try{
        await client.query(`
          INSERT INTO products(name,category,condition,purchase_price,sale_price,
            stock_quantity,stock_alert,supplier_name,color,grade,imei,
            numero_serie,statut_produit,type_entree,notes,barcode)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [row.name,row.categorie||'Autre',row.condition||'NEUF',
           Number(row.prix_achat||0),Number(row.prix_vente||0),
           Number(row.quantite||1),Number(row.stock_alert||3),
           row.fournisseur||null,row.couleur||null,row.grade||null,
           row.imei||null,row.numero_serie||null,
           row.statut||'DISPONIBLE',row.type_entree||'ACHAT_DIRECT',
           row.notes||null,row.barcode||null]);
        imported++;
      }catch(e){
        errors.push({line:i+2,error:e.message});
      }
    }
    await client.query('COMMIT');
    res.json({imported,errors,skipped,total:rows.length});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});


/* ── GET produits d'un lot depuis products ── */
app.get('/api/lots/:id/products', async(req,res)=>{
  try{
    const r = await pool.query(`
      SELECT p.*,
        COALESCE(json_agg(DISTINCT pb.*) FILTER (WHERE pb.id IS NOT NULL), '[]') AS barcodes,
        COALESCE((SELECT SUM(lc.amount) FROM lot_costs lc WHERE lc.product_id=p.id AND lc.lot_id=$1),0) AS frais_reparation
      FROM products p
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id
      WHERE p.lot_id = $1
      GROUP BY p.id
      ORDER BY p.id DESC`,
      [req.params.id]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* ── GET stats d'un lot depuis products ── */
app.get('/api/lots/:id/stats', async(req,res)=>{
  try{
    const r = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN statut_produit='DISPONIBLE'  THEN 1 END) AS nb_disponible,
        COUNT(CASE WHEN statut_produit='EN_TEST'     THEN 1 END) AS nb_test,
        COUNT(CASE WHEN statut_produit='REPARATION'  THEN 1 END) AS nb_reparation,
        COUNT(CASE WHEN statut_produit='IRREPARABLE' THEN 1 END) AS nb_irreparable,
        COUNT(CASE WHEN statut_produit='VENDU'       THEN 1 END) AS nb_vendu,
        COALESCE(SUM(purchase_price),0) AS total_achat,
        COALESCE(SUM(CASE WHEN statut_produit='VENDU' THEN sale_price ELSE 0 END),0) AS total_vendu
      FROM products WHERE lot_id=$1`,
      [req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});


/* ── TEMPLATE IMPORT STOCK (avec lot optionnel) ── */
app.get('/api/stock/template', async(req,res)=>{
  try{
    const path=require('path');
    const fs=require('fs');
    const{lot_id}=req.query;
    let lotName='';
    if(lot_id){
      const lr=await pool.query('SELECT name FROM lots WHERE id=$1',[lot_id]);
      if(lr.rows[0]) lotName=lr.rows[0].name;
    }
    /* Utiliser le template mise en forme existant */
    const templatePath=path.join(__dirname,'template_import_stock.xlsx');
    if(!fs.existsSync(templatePath)){
      return res.status(404).json({error:'Template non trouvé — copiez template_import_stock.xlsx dans le dossier app'});
    }
    if(!lot_id){
      /* Template générique */
      return res.download(templatePath,'template_import_stock.xlsx');
    }
    /* Modifier le lot_nom dans le template à la volée */
    const XlsxModule=require('xlsx');
    const wb=XlsxModule.readFile(templatePath);
    const ws=wb.Sheets[wb.SheetNames[0]];
    /* Trouver la colonne lot_nom (col K = index 10) et remplacer les exemples */
    /* Lignes 6 et 7 (index 5 et 6) = lignes d'exemple */
    const lotCol='K'; /* colonne lot_nom */
    [6,7,8,9,10,11,12].forEach(function(row){
      var cellRef=lotCol+row;
      if(ws[cellRef]) ws[cellRef].v=lotName;
      else ws[cellRef]={v:lotName,t:'s'};
    });
    const filename='template_'+lotName.replace(/[^a-zA-Z0-9]/g,'_')+'.xlsx';
    const buf=XlsxModule.write(wb,{type:'buffer',bookType:'xlsx'});
    res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  }catch(e){
    console.error('Template error:',e.message);
    res.status(500).json({error:e.message});
  }
});

/* ── IMPORT STOCK depuis JSON parsé côté client ── */
app.post('/api/stock/import', async(req,res)=>{
  const client = await pool.connect();
  try{
    const{rows}=req.body;
    if(!rows||!rows.length) return res.status(400).json({error:'Aucune ligne'});
    await client.query('BEGIN');
    var imported=0,errors=[],skipped=0;
    console.log('IMPORT rows count:', rows.length);
    if(rows[0]) console.log('first row keys:', Object.keys(rows[0]));
    if(rows[0]) console.log('first row values:', JSON.stringify(rows[0]));
    for(var i=0;i<rows.length;i++){
      var r=rows[i];
      var marque=(r.marque||'').trim();
      var modele=(r.modele||'').trim();
      var nom=modele.toLowerCase().includes(marque.toLowerCase())?modele:(marque+' '+modele).trim();
      if(!nom||!r.categorie){errors.push({ligne:i+5,erreur:'Nom ou catégorie manquant'});continue;}
      var lot_id=null;
      if(r.lot_nom && r.lot_nom.trim()){
        const lr=await client.query("SELECT id FROM lots WHERE LOWER(name)=LOWER($1) LIMIT 1",[r.lot_nom.trim()]);
        if(lr.rows[0]){
          lot_id=lr.rows[0].id;
        } else {
          console.log('Lot non trouvé pour:', r.lot_nom.trim());
        }
      }
      try{
        var typeEntree = lot_id ? 'LOT' : 'ACHAT_DIRECT';
        var statut = (r.statut||'EN_TEST').toUpperCase().trim();
        var validStatuts = ['EN_TEST','DISPONIBLE','REPARATION','IRREPARABLE','VENDU'];
        if (!validStatuts.includes(statut)) statut = 'EN_TEST';
        /* Anti-doublon IMEI */
        if(r.imei && r.imei.trim()){
          const existing=await client.query('SELECT id FROM products WHERE imei=$1',[r.imei.trim()]);
          if(existing.rows[0]){ skipped++; continue; }
        }
        await client.query(
          'INSERT INTO products(name,category,condition,imei,color,grade,purchase_price,sale_price,stock_quantity,stock_alert,statut_produit,type_entree,lot_id,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,3,$9,$10,$11,$12)',
          [nom, r.categorie||'Smartphone', r.condition||'OCCASION',
           r.imei||null, r.couleur||null, r.grade||null,
           Number(r.prix_achat||0), Number(r.prix_vente||1),
           statut, typeEntree, lot_id||null, r.notes||null]);
        imported++;
      }catch(e){errors.push({ligne:i+5,erreur:e.message});}
    }
    await client.query('COMMIT');
    res.json({imported,errors,skipped,total:rows.length});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});


/* ── GET prix de vente réel depuis orders pour un produit ── */
app.get('/api/products/:id/last-sale', async(req,res)=>{
  try{
    const r=await pool.query(`
      SELECT o.total, o.created_at FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      JOIN products p ON p.name=oi.name
      WHERE p.id=$1 AND o.status='completed'
      ORDER BY o.created_at DESC LIMIT 1`,
      [req.params.id]);
    res.json(r.rows[0]||null);
  }catch(e){res.status(500).json({error:e.message});}
});


/* =======================================================
   REPAIR PARTS — Pièces de réparation
======================================================= */

/* GET pièces d'une réparation */
app.get('/api/repairs/:id/parts', async(req,res)=>{
  try{
    const r=await pool.query(
      'SELECT * FROM repair_parts WHERE repair_id=$1 ORDER BY id',
      [req.params.id]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* POST ajouter une pièce */
app.post('/api/repairs/:id/parts', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{nom,cout,source,inclure_depense,product_id}=req.body;
    await client.query('BEGIN');
    const r=await client.query(
      `INSERT INTO repair_parts(repair_id,nom,cout,source,inclure_depense,product_id)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id,nom,Number(cout||0),source||'ACHAT',
       inclure_depense===true||inclure_depense==='true',product_id||null]);
    /* Si inclure_depense → créer dépense */
    if(inclure_depense===true||inclure_depense==='true'){
      const rep=await client.query('SELECT * FROM repairs WHERE id=$1',[req.params.id]);
      await client.query(
        `INSERT INTO expenses(description,amount,category,date)
         VALUES($1,$2,'Pièce réparation',CURRENT_DATE)`,
        ['Pièce: '+nom+' (Répar. '+(rep.rows[0]?.numero_rep||'#'+req.params.id)+')',
         Number(cout||0)]);
    }
    await client.query('COMMIT');
    res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* DELETE pièce */
app.delete('/api/repair-parts/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM repair_parts WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

/* PUT statut produit → REPARATION : crée fiche réparation auto */
app.post('/api/products/:id/to-repair', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{panne,prix_estime}=req.body;
    const prod=await client.query('SELECT * FROM products WHERE id=$1',[req.params.id]);
    const p=prod.rows[0];
    if(!p) return res.status(404).json({error:'Produit non trouvé'});

    await client.query('BEGIN');

    /* Générer numéro réparation */
    const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const numRes=await client.query("SELECT next_numero('REP',$1,'repairs','numero_rep') AS num",[dateStr]);
    const numero=numRes.rows[0].num;

    /* Nom du lot si applicable */
    let clientName='INTERNE';
    if(p.lot_id){
      const lotRes=await client.query('SELECT name FROM lots WHERE id=$1',[p.lot_id]);
      if(lotRes.rows[0]) clientName='LOT — '+lotRes.rows[0].name;
    }

    /* Créer la fiche réparation */
    const rep=await client.query(
      `INSERT INTO repairs(numero_rep,customer_name,phone,device_type,brand,model,
        issue,estimated_price,status,source,product_id,lot_id,created_at)
       VALUES($1,$2,'',COALESCE($3,'Smartphone'),COALESCE($4,''),COALESCE($5,''),
        $6,$7,'EN_ATTENTE','INTERNE',$8,$9,NOW()) RETURNING *`,
      [numero,clientName,p.category,
       (p.name||'').split(' ')[0],
       (p.name||''),
       panne||'À diagnostiquer',
       Number(prix_estime||0),
       p.id,p.lot_id||null]);

    /* Mettre à jour le statut du produit */
    await client.query(
      'UPDATE products SET statut_produit=$1,repair_id=$2 WHERE id=$3',
      ['REPARATION',rep.rows[0].id,req.params.id]);

    await client.query('COMMIT');
    res.json({repair:rep.rows[0],product_id:req.params.id});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* PUT réparation terminée → produit DISPONIBLE + frais lot */
app.post('/api/repairs/:id/terminer', async(req,res)=>{
  const client=await pool.connect();
  try{
    const{prix_final}=req.body;
    await client.query('BEGIN');

    /* Récupérer la réparation */
    const rep=await client.query('SELECT * FROM repairs WHERE id=$1',[req.params.id]);
    const r=rep.rows[0];
    if(!r) return res.status(404).json({error:'Réparation non trouvée'});

    /* Marquer terminée */
    const newStatus = req.body.status || 'TERMINE';
    await client.query(
      `UPDATE repairs SET status=$1,final_price=$2,delivered_at=NOW() WHERE id=$3`,
      [newStatus,Number(prix_final||r.estimated_price||0),req.params.id]);

    /* Si produit stock lié → DISPONIBLE */
    if(r.product_id){
      await client.query(
        'UPDATE products SET statut_produit=$1,repair_id=NULL WHERE id=$2',
        ['DISPONIBLE',r.product_id]);
    }

    /* Coût total des pièces */
    const partsRes=await client.query(
      'SELECT COALESCE(SUM(cout),0) AS total FROM repair_parts WHERE repair_id=$1',
      [req.params.id]);
    const coutPieces=Number(partsRes.rows[0].total||0);
    const prixFinal=Number(prix_final||r.estimated_price||0);
    const coutTotal=coutPieces; /* MO inclus dans estimated_price */

    /* Si lot → ajouter frais (même si 0, pour traçabilité) */
    if(r.lot_id){
      /* Montant = pièces + prix final réparation si pas de pièces */
      const montantFrais = coutTotal > 0 ? coutTotal : prixFinal;
      console.log('LOT COST: lot_id='+r.lot_id+' montant='+montantFrais+' pieces='+coutPieces);
      if(montantFrais > 0){
        await client.query(
          `INSERT INTO lot_costs(lot_id,description,amount,cost_type,repair_type,product_id,quantity)
           VALUES($1,$2,$3,'repair','parts',$4,1)`,
          [r.lot_id,
           'Répar. '+(r.numero_rep||'#'+r.id)+' — '+(r.brand||'')+' '+(r.model||''),
           montantFrais,
           r.product_id||null]);
      }
    }

    await client.query('COMMIT');
    res.json({success:true,cout_pieces:coutPieces,prix_final:prixFinal});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* GET rechercher un lot dans stock/réparations/ventes */
app.get('/api/lots/:id/search-all', async(req,res)=>{
  try{
    const id=req.params.id;
    const [prods,reps,sales]=await Promise.all([
      pool.query('SELECT id,name,statut_produit,sale_price,purchase_price FROM products WHERE lot_id=$1',[id]),
      pool.query('SELECT id,numero_rep,status,customer_name,brand,model FROM repairs WHERE lot_id=$1',[id]),
      pool.query(`SELECT o.id,o.total,o.created_at,oi.name FROM orders o
        JOIN order_items oi ON oi.order_id=o.id
        JOIN products p ON p.name=oi.name AND p.lot_id=$1
        WHERE o.status='completed' GROUP BY o.id,oi.name`,[id])
    ]);
    res.json({
      produits:prods.rows,
      reparations:reps.rows,
      ventes:sales.rows
    });
  }catch(e){res.status(500).json({error:e.message});}
});


/* ── POST lot-costs (frais manuels depuis stock) ── */
app.post('/api/lot-costs', async(req,res)=>{
  try{
    console.log('LOT-COSTS reçu:', JSON.stringify(req.body));
    const{lot_id,description,amount,cost_type,repair_type,product_id,quantity}=req.body;
    const r=await pool.query(
      `INSERT INTO lot_costs(lot_id,description,amount,cost_type,repair_type,product_id,quantity)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [lot_id,description||'Frais',Number(amount||0),
       cost_type||'repair',repair_type||'manual',product_id||null,quantity||1]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});


/* ══ TODOS (tâches partagées) ══ */
app.get('/api/todos', async(req,res)=>{
  try{
    const r=await pool.query('SELECT * FROM todos ORDER BY priority ASC, created_at DESC');
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/todos', async(req,res)=>{
  try{
    const{text,priority,created_by}=req.body;
    const r=await pool.query(
      'INSERT INTO todos(text,priority,done,created_by) VALUES($1,$2,false,$3) RETURNING *',
      [text,priority||'P1',created_by||'']);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/todos/:id', async(req,res)=>{
  try{
    const{done,text,priority}=req.body;
    const r=await pool.query(
      'UPDATE todos SET done=$1,text=COALESCE($2,text),priority=COALESCE($3,priority),updated_at=NOW() WHERE id=$4 RETURNING *',
      [done,text||null,priority||null,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/todos/:id', async(req,res)=>{
  try{
    await pool.query('DELETE FROM todos WHERE id=$1',[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});


/* ── IMPORT FACTURE PDF LCD PHONE ── */
app.post('/api/import-facture-pdf/upload', (req,res)=>{
  const path   = require('path');
  const fs     = require('fs');
  const {execSync} = require('child_process');
  const multer = require('multer');
  const upload = multer({dest: require('os').tmpdir()}).single('pdf');
  upload(req, res, function(err){
    if(err) return res.status(500).json({error:err.message});
    if(!req.file) return res.status(400).json({error:'Aucun fichier PDF'});
    const pdfPath  = req.file.path;
    const pyScript = path.join(__dirname,'parse_invoice.py');
    try{
      const out  = execSync('python3 "'+pyScript+'" "'+pdfPath+'"',{encoding:'utf-8'});
      const data = JSON.parse(out);
      fs.unlinkSync(pdfPath);
      res.json(data);
    }catch(e2){
      try{fs.unlinkSync(pdfPath);}catch(e3){}
      res.status(500).json({error:e2.message.slice(0,200)});
    }
  });
});

app.listen(3000,()=>console.log('🚀 The SMARTPHONE POS — http://localhost:3000'));
