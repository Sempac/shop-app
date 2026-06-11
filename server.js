const express=require('express');
require('dotenv').config();

/* Empêcher les crashes sur erreurs non gérées (ex: puppeteer/WhatsApp) */
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err.message);
});
const initRapportAuto = require('./rapport-auto');
const waClient = require('./wa-client');
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
app.patch('/api/products/:id/stock',async(req,res)=>{
  try{const r=await pool.query(`UPDATE products SET stock_quantity=$1 WHERE id=$2 RETURNING *`,[Number(req.body.stock_quantity||0),req.params.id]);
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
      await client.query(`UPDATE products SET stock_quantity=stock_quantity-$1,updated_at=NOW() WHERE id=$2`,[item.qty,item.id]);
      /* Mettre statut VENDU uniquement pour les produits LOT (articles unitaires).
         Les produits COMMANDE/DIRECT ont des quantités et restent DISPONIBLE. */
      await client.query(
        "UPDATE products SET statut_produit='VENDU' WHERE id=$1 AND type_entree='LOT' AND statut_produit!='VENDU'",
        [item.id]);
    }
    if(credit>0){await client.query(`INSERT INTO customer_credits(customer_name,phone,order_id,total_amount,amount_paid,amount_due,status,notes) VALUES($1,$2,$3,$4,$5,$6,'EN_COURS',$7)`,
      [customer||'Anonyme','',orderId,total.toFixed(2),(cb+cash).toFixed(2),credit.toFixed(2),comment||'']);}
    /* Auto-clôture des lots dont tous les produits sont vendus ou irréparables */
    const productIds=cart.map(i=>i.id);
    await client.query(`
      UPDATE lots SET status='VENDU'
      WHERE id IN (SELECT DISTINCT lot_id FROM products WHERE id=ANY($1) AND lot_id IS NOT NULL)
        AND status='EN_COURS'
        AND NOT EXISTS (
          SELECT 1 FROM products p2
          WHERE p2.lot_id=lots.id
            AND p2.statut_produit NOT IN ('VENDU','IRREPARABLE')
        )`,
      [productIds]);
    await client.query('COMMIT');res.json({success:true,orderId});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({success:false,error:e.message});}
  finally{client.release();}
});
app.get('/api/orders/search',async(req,res)=>{
  try{const{date_min,date_max,id,payment,customer,product}=req.query;
    const p=[];
    let q=`SELECT o.*, (SELECT STRING_AGG(COALESCE(p2.name,'Produit supprimé'),', ' ORDER BY COALESCE(p2.name,'Produit supprimé')) FROM order_items oi2 LEFT JOIN products p2 ON p2.id=oi2.product_id WHERE oi2.order_id=o.id) AS designation
      FROM orders o
      WHERE 1=1`;
    if(id){p.push(id);q+=` AND o.id=$${p.length}`;}
    if(date_min){p.push(date_min);q+=` AND DATE(o.created_at)>=$${p.length}`;}
    if(date_max){p.push(date_max);q+=` AND DATE(o.created_at)<=$${p.length}`;}
    if(payment){p.push(payment);q+=` AND o.payment_method=$${p.length}`;}
    if(customer){p.push('%'+customer+'%');q+=` AND o.customer_name ILIKE $${p.length}`;}
    if(product){p.push('%'+product+'%');q+=` AND EXISTS (SELECT 1 FROM order_items oi3 LEFT JOIN products p3 ON p3.id=oi3.product_id WHERE oi3.order_id=o.id AND p3.name ILIKE $${p.length})`;}
    q+=` ORDER BY o.id DESC LIMIT 200`;
    const r=await pool.query(q,p);res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/orders/:id',async(req,res)=>{
  try{const order=await pool.query(`SELECT * FROM orders WHERE id=$1`,[req.params.id]);
    const items=await pool.query(`SELECT oi.*,COALESCE(p.name,'Produit supprimé') AS name FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1 ORDER BY oi.id`,[req.params.id]);
    res.json({order:order.rows[0],items:items.rows});
  }catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/orders/:id',async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');
    /* Remettre le stock */
    await client.query(`UPDATE products p SET stock_quantity=stock_quantity+oi.quantity,updated_at=NOW() FROM order_items oi WHERE oi.order_id=$1 AND p.id=oi.product_id`,[req.params.id]);
    /* Remettre les produits LOT à DISPONIBLE */
    await client.query(`UPDATE products p SET statut_produit='DISPONIBLE' FROM order_items oi WHERE oi.order_id=$1 AND p.id=oi.product_id AND p.type_entree='LOT' AND p.statut_produit='VENDU'`,[req.params.id]);
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
        o.comment,STRING_AGG(DISTINCT COALESCE(p.name,'Produit supprimé'),', ') AS designation
      FROM orders o JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
      WHERE DATE(o.created_at)=$1 AND (o.status IS NULL OR o.status!='cancelled') AND o.payment_method!='credit'
      GROUP BY o.id ORDER BY o.id DESC`,[date]);
    const reps=await pool.query(`
      SELECT id,TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')||' '||COALESCE(device_type,'')) AS designation,
        payment_method,COALESCE(final_price,estimated_price,0) AS total,
        COALESCE(amount_cb,CASE WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END) AS amount_cb,
        COALESCE(amount_cash,CASE WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END) AS amount_cash,
        COALESCE(amount_credit,0) AS amount_credit,
        COALESCE(final_price,estimated_price,0) - COALESCE(amount_credit,0) AS encaisse
      FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE') ORDER BY id DESC`,[date]);
    const totV=await pool.query(`
      SELECT COUNT(*) AS nb_ventes,
        COALESCE(SUM(total - COALESCE(amount_credit,0)),0) AS grand_total,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0) WHEN payment_method='card' THEN total ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cash,0) WHEN payment_method='cash' THEN total ELSE 0 END),0) AS total_esp,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0)+COALESCE(amount_cash,0) WHEN payment_method IN ('card','cash','mixed') THEN total ELSE 0 END),0) AS total_encaisse,
        COALESCE(SUM(COALESCE(amount_credit,0)),0) AS total_credit
      FROM orders WHERE DATE(created_at)=$1 AND (status IS NULL OR status!='cancelled') AND payment_method!='credit'`,[date]);
    const totR=await pool.query(`
      SELECT COUNT(*) AS nb_reps,COALESCE(SUM(COALESCE(final_price,estimated_price,0) - COALESCE(amount_credit,0)),0) AS grand_total,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 THEN amount_cb WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cash,0)>0 THEN amount_cash WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_esp
      FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE')`,[date]);
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
      SELECT STRING_AGG(DISTINCT COALESCE(p.name,'Produit supprimé'), ', ') AS nom, '—' AS fournisseur,
        1 AS qty,
        o.total - COALESCE(o.amount_credit,0) AS total_ligne,
        COALESCE(o.amount_credit,0) AS amount_credit,
        o.payment_method, o.id AS order_id
      FROM orders o JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
      WHERE DATE(o.created_at)=$1 AND (o.status IS NULL OR o.status!='cancelled') AND o.payment_method!='credit'
      GROUP BY o.id ORDER BY o.id DESC`,[date]);
    const reps=await pool.query(`
      SELECT TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')||' '||COALESCE(device_type,'')) AS nom,
        1 AS qty,
        COALESCE(final_price,estimated_price,0) - COALESCE(amount_credit,0) AS total_ligne,
        COALESCE(amount_credit,0) AS amount_credit,
        payment_method
      FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE') ORDER BY id DESC`,[date]);
    const totV=await pool.query(`
      SELECT
        COALESCE(SUM(total - COALESCE(amount_credit,0)),0) AS total_ventes,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0) WHEN payment_method='card' THEN total ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cash,0) WHEN payment_method='cash' THEN total ELSE 0 END),0) AS total_esp
      FROM orders
      WHERE DATE(created_at)=$1 AND (status IS NULL OR status!='cancelled') AND payment_method!='credit'`,[date]);
    const totR=await pool.query(`
      SELECT COALESCE(SUM(COALESCE(final_price,estimated_price,0) - COALESCE(amount_credit,0)),0) AS total_reps,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 THEN amount_cb WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cash,0)>0 THEN amount_cash WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_esp
      FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE')`,[date]);
    const totDep=await pool.query(`SELECT COALESCE(SUM(amount),0) AS total_depenses FROM expenses WHERE DATE(date)=$1`,[date]);
    res.json({date,ventes:ventes.rows,reps:reps.rows,totaux:{
      total_ventes:parseFloat(totV.rows[0].total_ventes),total_reps:parseFloat(totR.rows[0].total_reps),
      total_cb:parseFloat(totV.rows[0].total_cb)+parseFloat(totR.rows[0].total_cb),
      total_esp:parseFloat(totV.rows[0].total_esp)+parseFloat(totR.rows[0].total_esp),
      total_dep:parseFloat(totDep.rows[0].total_depenses)}});
  }catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   RAPPORT COMPTABLE — GENERER PDF + EMAIL
======================================================= */
app.get('/api/rapport-comptable/generer', async(req,res)=>{
  try{
    const date=req.query.date||new Date().toISOString().split('T')[0];

    /* ── mêmes requêtes que /api/rapport-comptable ── */
    const ventes=await pool.query(`
      SELECT STRING_AGG(DISTINCT COALESCE(p.name,'Produit supprimé'), ', ') AS nom, '—' AS fournisseur,
        1 AS qty,
        o.total - COALESCE(o.amount_credit,0) AS total_ligne,
        COALESCE(o.amount_credit,0) AS amount_credit,
        o.payment_method
      FROM orders o JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
      WHERE DATE(o.created_at)=$1 AND (o.status IS NULL OR o.status!='cancelled') AND o.payment_method!='credit'
      GROUP BY o.id ORDER BY o.id DESC`,[date]);
    const reps=await pool.query(`
      SELECT TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')||' '||COALESCE(device_type,'')) AS nom,
        1 AS qty,
        COALESCE(final_price,estimated_price,0) - COALESCE(amount_credit,0) AS total_ligne,
        COALESCE(amount_credit,0) AS amount_credit,
        payment_method
      FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE') ORDER BY id DESC`,[date]);
    const totV2=await pool.query(`
      SELECT
        COALESCE(SUM(total - COALESCE(amount_credit,0)),0) AS total_ventes,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0) WHEN payment_method='card' THEN total ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cash,0) WHEN payment_method='cash' THEN total ELSE 0 END),0) AS total_esp
      FROM orders WHERE DATE(created_at)=$1 AND (status IS NULL OR status!='cancelled') AND payment_method!='credit'`,[date]);
    const totR=await pool.query(`
      SELECT COALESCE(SUM(COALESCE(final_price,estimated_price,0) - COALESCE(amount_credit,0)),0) AS total_reps,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 THEN amount_cb WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_cb,
        COALESCE(SUM(CASE WHEN COALESCE(amount_cash,0)>0 THEN amount_cash WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_esp
      FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE')`,[date]);
    const totDep=await pool.query(`SELECT COALESCE(SUM(amount),0) AS total_depenses FROM expenses WHERE DATE(date)=$1`,[date]);

    const t={
      total_ventes:parseFloat(totV2.rows[0].total_ventes),
      total_reps:  parseFloat(totR.rows[0].total_reps),
      total_cb:    parseFloat(totV2.rows[0].total_cb)+parseFloat(totR.rows[0].total_cb),
      total_esp:   parseFloat(totV2.rows[0].total_esp)+parseFloat(totR.rows[0].total_esp),
      total_dep:   parseFloat(totDep.rows[0].total_depenses)
    };
    const totalCA   = t.total_ventes + t.total_reps;
    const netCaisse = totalCA - t.total_dep;
    const fmt = n => Number(n||0).toFixed(2)+' EUR';

    /* ── Nom du fichier ── */
    const dateStr   = date.replace(/-/g,'');
    const dateLabel = new Date(date+'T00:00:00').toLocaleDateString('fr-FR',
      {weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const filename  = `Rapport Comptable - The SMARTPHONE - ${dateStr}.pdf`;
    const fs   = require('fs');
    const path = require('path');
    /* Dossier principal (toujours accessible, même en Session 0) */
    const fallbackDir = path.join(__dirname,'rapports');
    const rapportDir  = process.env.RAPPORT_DIR||fallbackDir;
    fs.mkdirSync(fallbackDir,{recursive:true});
    /* On essaie RAPPORT_DIR ; si l'écriture échoue (ex: OneDrive Session 0) → fallback ./rapports */
    let saveDir = rapportDir;
    const filePath = path.join(saveDir,filename);

    /* ── Génération PDF (pdfkit) ── */
    const PDFDocument=require('pdfkit');
    const doc=new PDFDocument({margin:40,size:'A4'});
    const chunks=[];
    doc.on('data',chunk=>chunks.push(chunk));
    const pdfDone=new Promise((resolve,reject)=>{doc.on('end',resolve);doc.on('error',reject);});

    /* En-tête */
    doc.font('Helvetica-Bold').fontSize(14).text('The SMARTPHONE',40,40);
    doc.font('Helvetica').fontSize(9).fillColor('#444')
       .text("1 Avenue d'Italie, 75013 Paris",40,57)
       .text('01 47 07 18 66  |  smartphonesatelier4@gmail.com',40,68);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
       .text('Rapport Comptable',0,40,{align:'right'})
       .font('Helvetica').fontSize(10)
       .text(date.split('-').reverse().join('/'),0,57,{align:'right'})
       .text(dateLabel,0,69,{align:'right'});
    doc.moveTo(40,85).lineTo(555,85).lineWidth(1.5).stroke('#000');

    /* Tableau détail */
    const colX=[40,220,370,430,480];
    const colW=[180,150, 60, 50, 75];
    let y=95;
    /* En-têtes colonnes */
    doc.rect(40,y,515,16).fill('#1e293b');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('white');
    ['Nom','Fournisseur','Qté','Type','CA'].forEach((h,i)=>{
      const align=i>=2?'right':'left';
      doc.text(h,colX[i],y+4,{width:colW[i],align});
    });
    y+=16;
    doc.fillColor('#000').font('Helvetica').fontSize(8);

    const allRows=[
      ...ventes.rows.map(l=>({nom:l.nom,four:l.fournisseur,qty:l.qty,type:'Vente',  ca:l.total_ligne})),
      ...reps.rows  .map(l=>({nom:l.nom||'Réparation',four:'—',qty:l.qty,type:'Réparation',ca:l.total_ligne}))
    ];

    if(allRows.length===0){
      doc.fillColor('#888').text('Aucune opération ce jour',40,y+4,{width:515,align:'center'});
      y+=16;
    } else {
      allRows.forEach((row,idx)=>{
        const bg=idx%2===0?'#f8fafc':'#ffffff';
        doc.rect(40,y,515,14).fill(bg);
        doc.fillColor('#000')
           .text(row.nom,   colX[0],y+3,{width:colW[0]-4,align:'left'})
           .text(row.four,  colX[1],y+3,{width:colW[1]-4,align:'left'})
           .text(String(row.qty),colX[2],y+3,{width:colW[2],align:'right'})
           .text(row.type,  colX[3],y+3,{width:colW[3],align:'right'})
           .text(fmt(row.ca),colX[4],y+3,{width:colW[4],align:'right'});
        y+=14;
      });
    }

    /* Séparateur + sous-totaux */
    doc.moveTo(40,y).lineTo(555,y).lineWidth(0.5).stroke('#888'); y+=4;
    [
      ['Total Ventes', t.total_ventes, false],
      ['Total Réparations', t.total_reps, false],
      ['Total CA', totalCA, true]
    ].forEach(([lbl,val,bold])=>{
      if(bold){doc.rect(40,y,515,16).fill('#f0f0f0');doc.moveTo(40,y).lineTo(555,y).lineWidth(1).stroke('#000');}
      doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(bold?10:8).fillColor('#000')
         .text(lbl,40,y+3,{width:420,align:'left'})
         .text(fmt(val),colX[4],y+3,{width:colW[4],align:'right'});
      y+=bold?16:14;
    });

    /* Récap paiements */
    y+=8;
    doc.moveTo(40,y).lineTo(555,y).lineWidth(1).stroke('#000'); y+=6;
    doc.font('Helvetica-Bold').fontSize(9).text('Récapitulatif paiements',40,y); y+=14;
    [
      ['CB',                 fmt(t.total_cb)],
      ['Espèces (ES)',       fmt(t.total_esp)],
      ['Dépenses (DP)',    t.total_dep>0 ? '- '+fmt(t.total_dep) : fmt(t.total_dep)],
    ].forEach(([lbl,val])=>{
      doc.font('Helvetica').fontSize(9).fillColor('#000')
         .text(lbl,40,y,{width:420}).text(val,colX[4],y,{width:colW[4],align:'right'});
      y+=14;
    });
    doc.moveTo(40,y).lineTo(555,y).lineWidth(1).stroke('#000'); y+=4;
    doc.rect(40,y,515,18).fill('#1e293b');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('white')
       .text('Net Caisse',42,y+3,{width:420})
       .text(fmt(netCaisse),colX[4],y+3,{width:colW[4],align:'right'});
    y+=18;

    /* Pied de page */
    y+=14;
    doc.font('Helvetica').fontSize(8).fillColor('#aaa')
       .text('Généré le '+new Date().toLocaleString('fr-FR'),40,y,{align:'right'});

    doc.end();
    await pdfDone;
    const pdfBuffer=Buffer.concat(chunks);

    /* ── Sauvegarde fichier (fallback si RAPPORT_DIR inaccessible) ── */
    let finalPath = filePath;
    try{
      fs.mkdirSync(saveDir,{recursive:true});
      fs.writeFileSync(filePath,pdfBuffer);
    }catch(_){
      saveDir   = fallbackDir;
      finalPath = path.join(fallbackDir,filename);
      fs.writeFileSync(finalPath,pdfBuffer);
    }

    /* ── Envoi email ── */
    let emailSent=false, emailError=null;
    try{
      const nodemailer=require('nodemailer');
      const transporter=nodemailer.createTransport({
        host:'smtp.gmail.com',port:465,secure:true,
        auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS}
      });
      await transporter.sendMail({
        from:`"The SMARTPHONE" <${process.env.EMAIL_USER}>`,
        to:process.env.EMAIL_TO||'ittech75013@gmail.com',
        subject:`Rapport Comptable – The SMARTPHONE – ${date}`,
        text:`Bonjour,\n\nVeuillez trouver en pièce jointe le rapport comptable du ${dateLabel}.\n\nThe SMARTPHONE\n1 Avenue d'Italie, 75013 Paris`,
        attachments:[{filename,content:pdfBuffer,contentType:'application/pdf'}]
      });
      emailSent=true;
    }catch(emailErr){emailError=emailErr.message;}

    res.json({success:true,saved:finalPath,saveDir,filename,emailSent,emailError});
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
app.get('/api/repairs/:id',async(req,res)=>{try{const r=await pool.query(`SELECT r.*,p.name AS cadeau_nom FROM repairs r LEFT JOIN products p ON p.id=r.cadeau_product_id WHERE r.id=$1`,[req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/repairs',async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const numRes=await client.query("SELECT next_numero('REP',$1,'repairs','numero_rep') AS num",[dateStr]);
    const numero=numRes.rows[0].num;
    const status=req.body.status||'EN_ATTENTE';
    const cb=Number(req.body.amount_cb||0),cash=Number(req.body.amount_cash||0),credit=Number(req.body.amount_credit||0);
    let pm=req.body.payment_method||'cash';
    if(cb>0&&cash>0)pm='mixed';else if(cb>0)pm='card';else if(cash>0)pm='cash';else if(credit>0)pm='credit';
    const fp=Number(req.body.final_price||req.body.estimated_price||0);
    const ep=Number(req.body.estimated_price||fp);
    const cadeauId=Number(req.body.cadeau_product_id)||null;
    const cadeauQty=Number(req.body.cadeau_qty)||1;
    const r=await client.query(
      `INSERT INTO repairs(numero_rep,customer_name,phone,device_type,brand,model,
        serial_number,issue,estimated_price,final_price,comment,garantie,
        status,payment_method,amount_cb,amount_cash,amount_credit,
        cadeau_product_id,cadeau_qty,
        created_at,delivered_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),
        CASE WHEN $20 THEN NOW() ELSE NULL END) RETURNING *`,
      [numero,req.body.customer_name||'',req.body.phone||'',req.body.device_type||'',
       req.body.brand||'',req.body.model||'',req.body.serial_number||'',
       req.body.issue||'',ep,fp,
       req.body.comment||'',req.body.garantie||null,
       status,pm,cb,cash,credit,
       cadeauId,cadeauQty,
       !!(status==='LIVRE')]);
    const repairId=r.rows[0].id;
    if(cadeauId){await client.query(`UPDATE products SET stock_quantity=GREATEST(0,COALESCE(stock_quantity,0)-$1) WHERE id=$2`,[cadeauQty,cadeauId]);}
    const items=Array.isArray(req.body.items)?req.body.items:[];
    for(const item of items){
      if(!item.panne&&!item.nom)continue;
      await client.query(
        `INSERT INTO repair_parts(repair_id,nom,cout,source,panne,prix_reparation)
         VALUES($1,$2,$3,'ACHAT',$4,$5)`,
        [repairId,item.nom||item.panne||'',0,item.panne||null,Number(item.prix_reparation||0)]);
    }
    await client.query('COMMIT');
    res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});
app.put('/api/repairs/:id',async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const status=String(req.body.status||'EN_ATTENTE');
    const repair_date=req.body.repair_date||null;
    const delivery_date=req.body.delivery_date||null;
    const fp=Number(req.body.final_price||0);
    const ep=Number(req.body.estimated_price||0);
    const cb=Number(req.body.amount_cb||0),cash=Number(req.body.amount_cash||0),credit=Number(req.body.amount_credit||0);
    const{customer_name,phone,device_type,brand,model,serial_number,issue,comment}=req.body;
    let pm='cash';if(cb>0&&cash>0)pm='mixed';else if(cb>0)pm='card';else if(cash>0)pm='cash';else if(credit>0)pm='credit';
    const newCadeauId=Number(req.body.cadeau_product_id)||null;
    const newCadeauQty=Number(req.body.cadeau_qty)||1;
    /* Lire l'ancien cadeau pour gérer le stock */
    const oldRow=await client.query('SELECT cadeau_product_id,cadeau_qty FROM repairs WHERE id=$1',[req.params.id]);
    const oldCadeauId=oldRow.rows[0]?.cadeau_product_id||null;
    const oldCadeauQty=oldRow.rows[0]?.cadeau_qty||1;
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
      cadeau_product_id=$19,cadeau_qty=$20,
      updated_at=NOW(),
      created_at=COALESCE(CASE WHEN $17::text IS NOT NULL THEN $17::timestamp ELSE NULL END,created_at),
      delivered_at=CASE WHEN $18::text IS NOT NULL AND $18::text!='' THEN $18::timestamp WHEN CAST($1 AS varchar)='LIVRE' THEN COALESCE(delivered_at,NOW()) ELSE delivered_at END
      WHERE id=$16 RETURNING *`,
      [status,fp,ep,customer_name||'',phone||'',device_type||'',brand||'',model||'',serial_number||'',issue||'',comment||'',pm,cb,cash,credit,req.params.id,repair_date||null,delivery_date||null,newCadeauId,newCadeauQty]);
    /* Ajustement stock cadeau si changement */
    if(oldCadeauId!==newCadeauId){
      if(oldCadeauId)await client.query(`UPDATE products SET stock_quantity=COALESCE(stock_quantity,0)+$1 WHERE id=$2`,[oldCadeauQty,oldCadeauId]);
      if(newCadeauId)await client.query(`UPDATE products SET stock_quantity=GREATEST(0,COALESCE(stock_quantity,0)-$1) WHERE id=$2`,[newCadeauQty,newCadeauId]);
    }
    if(credit>0){const rep=r.rows[0];const ex=await client.query(`SELECT id FROM customer_credits WHERE repair_id=$1`,[req.params.id]);
      if(ex.rows.length===0){await client.query(`INSERT INTO customer_credits(customer_name,phone,repair_id,total_amount,amount_paid,amount_due,status) VALUES($1,$2,$3,$4,$5,$6,'EN_COURS')`,
        [rep.customer_name||'Anonyme',rep.phone||'',req.params.id,fp,(cb+cash).toFixed(2),credit.toFixed(2)]);}
      else{await client.query(`UPDATE customer_credits SET amount_paid=$1,amount_due=$2,status=CASE WHEN $2<=0 THEN 'SOLDE' ELSE 'EN_COURS' END WHERE repair_id=$3`,
        [(cb+cash).toFixed(2),credit.toFixed(2),req.params.id]);}
    }
    /* Sync pannes/pièces si items fournis */
    if(Array.isArray(req.body.items)){
      await client.query('DELETE FROM repair_parts WHERE repair_id=$1',[req.params.id]);
      for(const item of req.body.items){
        if(!item.panne&&!item.nom)continue;
        await client.query(
          `INSERT INTO repair_parts(repair_id,nom,cout,source,panne,prix_reparation)
           VALUES($1,$2,$3,'ACHAT',$4,$5)`,
          [req.params.id,item.nom||item.panne||'',0,item.panne||null,Number(item.prix_reparation||0)]);
      }
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
    const{description,amount,amount_ht,amount_ttc,taux_tva,category,date,quantity}=req.body;
    const qty=Math.max(1,parseInt(quantity)||1);
    const tva=Number(taux_tva||20);
    const ttc=amount_ttc?Number(amount_ttc):Number(amount||0);
    const ht=amount_ht?Number(amount_ht):(tva>0?ttc/(1+tva/100):ttc);
    const r=await pool.query(
      `UPDATE expenses SET description=$1,amount=$2,amount_ht=$3,amount_ttc=$4,
       taux_tva=$5,category=$6,date=$7,quantity=$8 WHERE id=$9 RETURNING *`,
      [description||'',ttc,Number(ht.toFixed(2)),Number(ttc.toFixed(2)),
       tva,category||'Autre',date||new Date().toISOString().split('T')[0],qty,req.params.id]);
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
    const{description,amount,amount_ht,amount_ttc,taux_tva,category,date,quantity}=req.body;
    const qty=Math.max(1,parseInt(quantity)||1);
    const dateStr=(date||new Date().toISOString().slice(0,10)).replace(/-/g,'');
    const numRes=await pool.query("SELECT next_numero('DEP',$1,'expenses','numero') AS num",[dateStr]);
    const numero=numRes.rows[0].num;
    /* Calcul HT/TTC automatique si non fourni */
    const tva=Number(taux_tva||20);
    const ht=amount_ht?Number(amount_ht):Number(amount||0)/(1+tva/100);
    const ttc=amount_ttc?Number(amount_ttc):Number(amount||0);
    const r=await pool.query(
      `INSERT INTO expenses(numero,description,amount,amount_ht,amount_ttc,taux_tva,category,date,quantity)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [numero,description||'',Number(amount||ttc),Number(ht.toFixed(2)),Number(ttc.toFixed(2)),tva,
       category||'Autre',date||new Date().toISOString().split('T')[0],qty]);
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
app.post('/api/print/upload',upload.single('file'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'Aucun fichier reçu'});const{copies=1,color_mode='bw',orientation='portrait',source=''}=req.body;const prefix=source==='client'?'[CLIENT] ':'';const r=await pool.query(`INSERT INTO print_queue(filename,filepath,filetype,filesize,copies,color_mode,orientation,status) VALUES($1,$2,$3,$4,$5,$6,$7,'EN_ATTENTE') RETURNING *`,[prefix+req.file.originalname,'uploads/'+req.file.filename,path.extname(req.file.originalname).replace('.',''),req.file.size,Number(copies),color_mode,orientation]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/print/queue',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM print_queue ORDER BY uploaded_at DESC LIMIT 50`);res.json(r.rows);}catch(e){res.status(500).json({error:e.message});}});
/* Liste des imprimantes Windows disponibles */
app.get('/api/print/printers',async(req,res)=>{
  require('child_process').exec(
    'powershell -Command "Get-WmiObject Win32_Printer | Select-Object -ExpandProperty Name"',
    (err,stdout)=>{
      if(err) return res.json(['Brother HL-L6300DW series Printer','MF650C Series']);
      const list=stdout.split('\n').map(s=>s.trim()).filter(Boolean);
      res.json(list);
    }
  );
});
app.put('/api/print/:id/done',async(req,res)=>{try{const r=await pool.query(`UPDATE print_queue SET status='IMPRIME',printed_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/print/:id/cancel',async(req,res)=>{try{const r=await pool.query(`UPDATE print_queue SET status='ANNULE' WHERE id=$1 RETURNING *`,[req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/print/purge',async(req,res)=>{try{const r=await pool.query(`DELETE FROM print_queue WHERE status IN ('IMPRIME','ANNULE')`);res.json({deleted:r.rowCount});}catch(e){res.status(500).json({error:e.message});}});
/* Ouvrir fichier dans l'appli par défaut pour modification */
app.get('/api/print/:id/open',async(req,res)=>{
  try{
    const r=await pool.query(`SELECT * FROM print_queue WHERE id=$1`,[req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Introuvable'});
    const fp=require('path').resolve(__dirname,r.rows[0].filepath);
    const fp2=fp.replace(/'/g,"''");
    require('child_process').exec(
      `powershell -Command "Start-Process -FilePath '${fp2}'"`,
      (err)=>{ if(err) console.error('open:',err.message); }
    );
    res.json({ok:true,filepath:fp});
  }catch(e){res.status(500).json({error:e.message});}
});

/* Impression directe Windows sans ouvrir visuellement :
   - PDF/images/Word → Start-Process -Verb Print (imprime sur l'imprimante par défaut)
   - Le vendeur voit juste la boîte de dialogue Windows de sélection imprimante si besoin */
app.get('/api/print/:id/printdirect',async(req,res)=>{
  try{
    const r=await pool.query(`SELECT * FROM print_queue WHERE id=$1`,[req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Introuvable'});
    const fp=require('path').resolve(__dirname,r.rows[0].filepath);
    const copies=r.rows[0].copies||1;
    const colorMode=r.rows[0].color_mode||'bw';
    const ext=require('path').extname(fp).toLowerCase();
    const {exec}=require('child_process');
    /* Imprimante : paramètre URL prioritaire, sinon selon couleur */
    const printer = req.query.printer
      ? decodeURIComponent(req.query.printer)
      : (colorMode==='color' ? 'MF650C Series' : 'Brother HL-L6300DW series Printer');
    const fp2=fp.replace(/'/g,"''");
    const pr2=printer.replace(/'/g,"''");
    const sumatra='C:\\tools\\SumatraPDF.exe';
    const pdfTypes=['.pdf','.jpg','.jpeg','.png','.bmp','.tiff','.tif','.gif'];
    if(pdfTypes.includes(ext)){
      /* SumatraPDF — impression silencieuse multi-copies PDF + images */
      exec(`"${sumatra}" -print-to "${printer}" -print-settings "${copies}x" "${fp}"`,
        (err)=>{ if(err) console.error('printdirect sumatra:',err.message); });
    } else {
      /* Word, Excel, PPT → PrintTo via Windows shell */
      exec(`powershell -Command "Start-Process -FilePath '${fp2}' -Verb PrintTo -ArgumentList '${pr2}'"`,
        (err)=>{ if(err) console.error('printdirect:',err.message); });
    }
    res.json({ok:true, printer});
  }catch(e){res.status(500).json({error:e.message});}
});

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
    const{copies,color_mode,orientation}=req.body;
    const r=await pool.query(
      `UPDATE print_queue SET copies=$1,color_mode=$2,orientation=$3,status='EN_ATTENTE',updated_at=NOW() WHERE id=$4 RETURNING *`,
      [Number(copies||1),color_mode||'bw',orientation||'portrait',req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Travail introuvable ou expiré'});
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});


/* =======================================================
   USERS & AUTH
======================================================= */

/* ── Rate limiting anti-brute force ── */
const loginAttempts=new Map(); /* ip -> {count, blockedUntil} */
const RATE_MAX=5;              /* tentatives avant blocage */
const RATE_WINDOW=15*60*1000;  /* 15 minutes en ms */

function getClientIp(req){
  /* Tailscale Funnel passe l'IP réelle dans x-forwarded-for */
  const fwd=req.headers['x-forwarded-for'];
  if(fwd)return fwd.split(',')[0].trim();
  return req.ip||req.connection.remoteAddress||'unknown';
}

function checkRateLimit(ip){
  const now=Date.now();
  const e=loginAttempts.get(ip)||{count:0,blockedUntil:0};
  if(e.blockedUntil>now){
    const mins=Math.ceil((e.blockedUntil-now)/60000);
    return{blocked:true,remaining:mins};
  }
  /* Expiration automatique si la fenêtre est passée */
  if(e.blockedUntil>0 && e.blockedUntil<=now) loginAttempts.delete(ip);
  return{blocked:false,count:e.count};
}

function recordFail(ip){
  const now=Date.now();
  const e=loginAttempts.get(ip)||{count:0,blockedUntil:0};
  e.count++;
  if(e.count>=RATE_MAX){e.blockedUntil=now+RATE_WINDOW;e.count=0;}
  loginAttempts.set(ip,e);
}

function clearAttempts(ip){loginAttempts.delete(ip);}

/* Nettoyage toutes les heures */
setInterval(()=>{
  const now=Date.now();
  for(const[ip,e] of loginAttempts){if(e.blockedUntil<=now)loginAttempts.delete(ip);}
},3600*1000);

app.get('/api/users', async(req,res)=>{
  try{
    const r=await pool.query(
      `SELECT id,name,role,auth_type,is_active FROM app_users WHERE is_active=true ORDER BY role DESC,name ASC`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/auth/login', async(req,res)=>{
  const ip=getClientIp(req);
  const rate=checkRateLimit(ip);
  if(rate.blocked){
    return res.status(429).json({
      error:`Trop de tentatives. Réessayez dans ${rate.remaining} minute${rate.remaining>1?'s':''}.`,
      blocked:true, remaining:rate.remaining
    });
  }
  try{
    const{user_id,type,value}=req.body;
    const r=await pool.query(`SELECT * FROM app_users WHERE id=$1 AND is_active=true`,[user_id]);
    if(!r.rows[0]){recordFail(ip);return res.status(401).json({error:'Utilisateur introuvable'});}
    const user=r.rows[0];
    let ok=false;
    if(type==='pin'){
      ok=(user.pin===value);
    } else {
      ok=(user.password_hash===value);
    }
    if(!ok){
      recordFail(ip);
      const e=loginAttempts.get(ip)||{count:0};
      const left=RATE_MAX-e.count;
      return res.status(401).json({
        error:'PIN incorrect',
        attempts_left: left>0?left:0
      });
    }
    clearAttempts(ip);
    res.json({user:{id:user.id,name:user.name,role:user.role,auth_type:user.auth_type}});
  }catch(e){res.status(500).json({error:e.message});}
});

/* Changer son propre PIN */
app.post('/api/auth/change-pin', async(req,res)=>{
  try{
    const{user_id,current_pin,new_pin}=req.body;
    const r=await pool.query(`SELECT * FROM app_users WHERE id=$1 AND is_active=true`,[user_id]);
    if(!r.rows[0])return res.status(404).json({error:'Utilisateur introuvable'});
    const user=r.rows[0];
    /* Vérifier le PIN actuel */
    if(user.pin!==current_pin && user.password_hash!==current_pin)
      return res.status(401).json({error:'PIN actuel incorrect'});
    /* Valider la longueur du nouveau PIN */
    const expectedLen=(user.role==='admin'||user.role==='gerant')?6:4;
    if(!new_pin||!/^\d+$/.test(new_pin)||new_pin.length!==expectedLen)
      return res.status(400).json({error:`Le nouveau PIN doit faire ${expectedLen} chiffres`});
    /* Interdire de remettre le même PIN */
    if(new_pin===current_pin)
      return res.status(400).json({error:'Le nouveau PIN doit être différent de l\'ancien'});
    await pool.query(
      `UPDATE app_users SET pin=$1,password_hash=$2,updated_at=NOW() WHERE id=$3`,
      [new_pin,new_pin,user_id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/users/:id', async(req,res)=>{
  try{
    const r=await pool.query(`SELECT id,name,role,auth_type,is_active FROM app_users WHERE id=$1`,[req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

/* PIN visible uniquement depuis le module admin (Kader) */
app.get('/api/users/:id/pin', async(req,res)=>{
  try{
    const r=await pool.query(`SELECT id,name,pin FROM app_users WHERE id=$1`,[req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Utilisateur introuvable'});
    res.json({pin:r.rows[0].pin, name:r.rows[0].name});
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
    const role=req.query.role==='stagiaire'?'vendeur':(req.query.role||'gerant');
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
    const{statut,date_livraison,notes,numero_facture,fichier_pdf,
          transporteur,fournisseur,date_facture,date_commande,paiement}=req.body;
    const r=await pool.query(
      `UPDATE commandes SET statut=COALESCE($1,statut),
        date_livraison_prevue=COALESCE($2::date,date_livraison_prevue),
        notes=COALESCE($3,notes),
        numero_facture=COALESCE($4,numero_facture),
        fichier_pdf=COALESCE($5,fichier_pdf),
        transporteur=COALESCE($7,transporteur),
        fournisseur=COALESCE($8,fournisseur),
        date_facture=COALESCE($9::date,date_facture),
        date_commande=COALESCE($10::date,date_commande),
        paiement=COALESCE($11,paiement),
        updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [statut||null,date_livraison||null,notes||null,
       numero_facture||null,fichier_pdf||null,req.params.id,
       transporteur||null,fournisseur||null,
       date_facture||null,date_commande||null,paiement||null]);

    /* Si passage en RECU → créer/mettre à jour les produits dans le stock */
    if(statut==='RECU'){
      const cmd=r.rows[0];
      const items=await pool.query('SELECT * FROM commande_items WHERE commande_id=$1',[req.params.id]);
      for(const it of items.rows){
        const qty = Number(it.quantite_cmd||1);
        const nom = it.nom||'Produit';
        const cat = it.categorie||'Pièce détachée';
        const prix = Number(it.prix_ht||0);
        const fournisseur = cmd.fournisseur||'';
        const noteStr = '['+it.reference+'] '+nom+' — Facture #'+cmd.numero_facture;
        /* Chercher si une ligne identique existe déjà dans le stock */
        const existing = await pool.query(
          `SELECT id, stock_quantity FROM products 
           WHERE name=$1 AND category=$2 AND type_entree='COMMANDE' AND supplier_name=$3`,
          [nom, cat, fournisseur]);
        if(existing.rows.length>0){
          /* Mettre à jour la quantité existante */
          await pool.query(
            `UPDATE products SET stock_quantity=stock_quantity+$1, notes=$2 WHERE id=$3`,
            [qty, noteStr, existing.rows[0].id]);
        } else {
          /* Créer une nouvelle ligne avec la quantité totale */
          await pool.query(
            `INSERT INTO products(name,category,condition,purchase_price,sale_price,
             stock_quantity,stock_alert,supplier_name,statut_produit,type_entree,notes)
             VALUES($1,$2,'NEUF',$3,0,$4,3,$5,'DISPONIBLE','COMMANDE',$6)`,
            [nom,cat,prix,qty,fournisseur,noteStr]);
        }
      }
    }

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
    var imported=0, errors=[], skipped=0;
    for(var i=0;i<rows.length;i++){
      var row=rows[i];
      if(!row.name||!row.category||!row.prix_vente){
        errors.push({line:i+2,error:'Champs obligatoires manquants (nom, categorie, prix_vente)'});
        continue;
      }
      /* Anti-doublon IMEI */
      if(row.imei&&row.imei.trim()){
        const existing=await client.query('SELECT id FROM products WHERE imei=$1',[row.imei.trim()]);
        if(existing.rows[0]){skipped++;continue;}
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
        COALESCE((SELECT SUM(lc.amount) FROM lot_costs lc WHERE lc.product_id=p.id AND lc.lot_id=$1),0) AS frais_reparation,
        (SELECT o.created_at FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=p.id ORDER BY o.created_at DESC LIMIT 1) AS date_vente,
        (SELECT r.created_at FROM repairs r WHERE r.id=p.repair_id) AS date_reparation
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
      pool.query(`SELECT o.id,o.numero,o.total,o.created_at,p.name AS product_name
        FROM orders o
        JOIN order_items oi ON oi.order_id=o.id
        JOIN products p ON p.id=oi.product_id AND p.lot_id=$1
        WHERE o.status='completed'
        ORDER BY o.created_at DESC`,[id])
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
  const {exec} = require('child_process'); /* async — ne bloque pas le serveur */
  const multer = require('multer');
  const upload = multer({dest: require('os').tmpdir()}).single('pdf');
  upload(req, res, function(err){
    if(err) return res.status(500).json({error:err.message});
    if(!req.file) return res.status(400).json({error:'Aucun fichier PDF'});
    const pdfPath  = req.file.path;
    const pyScript = path.join(__dirname,'parse_invoice.py');
    /* Chemin absolu Python — évite les problèmes de PATH du planificateur de tâches Windows */
    const WIN_PYTHON = 'C:\\Users\\PC\\AppData\\Local\\Python\\bin\\python.exe';
    const pyCmd = process.platform === 'win32'
      ? (require('fs').existsSync(WIN_PYTHON) ? '"' + WIN_PYTHON + '"' : 'python')
      : 'python3';
    const cmd      = pyCmd + ' "' + pyScript + '" "' + pdfPath + '"';
    exec(cmd, {encoding:'utf-8', timeout:60000}, function(err2, stdout, stderr){
      try{ fs.unlinkSync(pdfPath); }catch(e){}
      if(err2) return res.status(500).json({error:(stderr||err2.message).slice(0,300)});
      try{
        const data = JSON.parse(stdout);
        res.json(data);
      }catch(e3){
        res.status(500).json({error:'Réponse Python invalide : ' + stdout.slice(0,200)});
      }
    });
  });
});


/* ── GMAIL API (OAuth2) — IMPORT FACTURES PDF ── */
const GMAIL_TOKEN_FILE = require('path').join(__dirname, 'gmail_tokens.json');

function _gmailOAuth2() {
  const { google } = require('googleapis');
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/gmail/auth/callback'
  );
}

async function _gmailClient() {
  const fs = require('fs');
  const { google } = require('googleapis');
  if (!fs.existsSync(GMAIL_TOKEN_FILE))
    throw new Error('Gmail non autorise. Visitez http://localhost:3000/api/gmail/auth');
  const tokens = JSON.parse(fs.readFileSync(GMAIL_TOKEN_FILE, 'utf8'));
  const oauth2 = _gmailOAuth2();
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', t => {
    Object.assign(tokens, t);
    fs.writeFileSync(GMAIL_TOKEN_FILE, JSON.stringify(tokens));
  });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

function _gmailFindPdfParts(part, acc) {
  if (!part) return;
  if (part.filename && /\.pdf$/i.test(part.filename) && part.body?.attachmentId)
    acc.push({ filename: part.filename, attachmentId: part.body.attachmentId, size: part.body.size || 0 });
  (part.parts || []).forEach(p => _gmailFindPdfParts(p, acc));
}

/* Autorisation OAuth2 — à visiter une seule fois dans le navigateur */
app.get('/api/gmail/auth', (req, res) => {
  const url = _gmailOAuth2().generateAuthUrl({
    access_type: 'offline', scope: ['https://www.googleapis.com/auth/gmail.readonly'], prompt: 'consent'
  });
  res.redirect(url);
});

app.get('/api/gmail/auth/callback', async (req, res) => {
  const fs = require('fs');
  try {
    const oauth2 = _gmailOAuth2();
    const { tokens } = await oauth2.getToken(req.query.code);
    fs.writeFileSync(GMAIL_TOKEN_FILE, JSON.stringify(tokens));
    res.send('<h2 style="font-family:Arial;color:green;padding:40px">✅ Gmail autorisé ! Vous pouvez fermer cette page et retourner dans l\'application.</h2>');
  } catch(e) { res.status(500).send('Erreur: ' + e.message); }
});

app.get('/api/gmail/factures', async (req, res) => {
  try {
    const gmail = await _gmailClient();
    const list = await gmail.users.messages.list({
      userId: 'me', q: 'has:attachment filename:pdf newer_than:90d', maxResults: 60
    });
    const msgIds = list.data.messages || [];
    const messages = [];
    await Promise.all(msgIds.map(async ({ id }) => {
      const msg = await gmail.users.messages.get({
        userId: 'me', id, format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });
      const get = n => msg.data.payload.headers.find(h => h.name === n)?.value || '';
      const pdfs = [];
      _gmailFindPdfParts(msg.data.payload, pdfs);
      if (!pdfs.length) return;
      messages.push({ id, date: get('Date'), from: get('From'), subject: get('Subject'), attachments: pdfs });
    }));
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(messages);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gmail/import-facture/:msgId', (req, res) => {
  const path = require('path');
  const fs   = require('fs');
  const os   = require('os');
  const { exec } = require('child_process');
  const { attachmentId } = req.body;
  const msgId = req.params.msgId;

  (async () => {
    const gmail = await _gmailClient();
    const att = await gmail.users.messages.attachments.get({
      userId: 'me', messageId: msgId, id: attachmentId
    });
    const buffer = Buffer.from(att.data.data, 'base64');
    const tmpPath = path.join(os.tmpdir(), `facture_gmail_${msgId}_${Date.now()}.pdf`);
    fs.writeFileSync(tmpPath, buffer);

    const pyScript  = path.join(__dirname, 'parse_invoice.py');
    const WIN_PYTHON = 'C:\\Users\\PC\\AppData\\Local\\Python\\bin\\python.exe';
    const pyCmd = process.platform === 'win32'
      ? (fs.existsSync(WIN_PYTHON) ? '"' + WIN_PYTHON + '"' : 'python')
      : 'python3';
    exec(`${pyCmd} "${pyScript}" "${tmpPath}"`, { encoding: 'utf-8', timeout: 60000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpPath); } catch {}
      if (err) return res.status(500).json({ error: (stderr || err.message).slice(0, 300) });
      try { res.json(JSON.parse(stdout)); }
      catch { res.status(500).json({ error: 'Reponse Python invalide: ' + stdout.slice(0, 200) }); }
    });
  })().catch(e => res.status(500).json({ error: e.message }));
});


/* ── PUT commandes/:id/items ── */
app.put('/api/commandes/:id/items', async(req,res)=>{
  const client = await pool.connect();
  try{
    const {items} = req.body;
    await client.query('BEGIN');
    for(const it of (items||[])){
      await client.query(
        `UPDATE commande_items SET reference=$1,nom=$2,taux_tva=$3,
         prix_ht=$4,prix_ttc=$5,quantite_cmd=$6 WHERE id=$7`,
        [it.reference||null,it.nom||'',Number(it.taux_tva||20),
         Number(it.prix_ht||0),Number(it.prix_ttc||0),Number(it.quantite_cmd||1),it.id]);
    }
    /* Si commande RECU → resynchroniser le stock */
    const cmdStatus = await client.query('SELECT statut, fournisseur, numero_facture FROM commandes WHERE id=$1',[req.params.id]);
    if(cmdStatus.rows[0]?.statut === 'RECU'){
      const cmd = cmdStatus.rows[0];
      for(const it of (items||[])){
        const qty = Number(it.quantite_cmd||1);
        const nom = it.nom||'Produit';
        const cat = it.categorie||'Pièce détachée';
        /* Chercher le produit stock lié */
        const existing = await client.query(
          `SELECT id FROM products WHERE name=$1 AND category=$2 AND type_entree='COMMANDE' AND supplier_name=$3`,
          [nom, cat, cmd.fournisseur||'']);
        if(existing.rows.length>0){
          /* Mettre à jour la quantité */
          await client.query(
            `UPDATE products SET stock_quantity=$1 WHERE id=$2`,
            [qty, existing.rows[0].id]);
        }
      }
    }

    await client.query('COMMIT');
    res.json({success:true});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});

/* ── DELETE commandes/:id ── */
app.delete('/api/commandes/:id', async(req,res)=>{
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    /* Récupérer le numéro de facture */
    const cmd = await client.query('SELECT numero_facture FROM commandes WHERE id=$1',[req.params.id]);
    const numFac = cmd.rows[0]?.numero_facture;
    /* Supprimer les dépenses liées */
    if(numFac){
      await client.query("DELETE FROM expenses WHERE description LIKE $1",['%#'+numFac+'%']);
    }
    /* Supprimer les produits stock liés (type_entree=COMMANDE + notes contenant le numéro facture) */
    if(numFac){
      await client.query("DELETE FROM products WHERE type_entree='COMMANDE' AND notes LIKE $1",['%#'+numFac+'%']);
    }
    /* Supprimer les items et la commande */
    await client.query('DELETE FROM commande_items WHERE commande_id=$1',[req.params.id]);
    await client.query('DELETE FROM commandes WHERE id=$1',[req.params.id]);
    await client.query('COMMIT');
    res.json({success:true});
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});


/* ── CATALOGUE PUBLIC ── */
app.get('/api/catalogue', async(req,res)=>{
  try{
    const{category,search,lang}=req.query;
    let sql=`SELECT id,name,category,condition,color,grade,sale_price,
             statut_produit,supplier_name,notes,imei
             FROM products 
             WHERE statut_produit='DISPONIBLE' AND sale_price>0`;
    const p=[];
    if(category){p.push(category);sql+=` AND category=$${p.length}`;}
    if(search){p.push('%'+search+'%');sql+=` AND name ILIKE $${p.length}`;}
    sql+=' ORDER BY category,name ASC';
    const r=await pool.query(sql,p);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   CATALOGUE PUBLIC
======================================================= */

// Page catalogue publique
app.get('/catalogue', (req,res) => {
  res.sendFile(path.join(__dirname,'catalogue.html'));
});

// Données catalogue (public)
app.get('/api/catalogue/data', async(req,res) => {
  try {
    const settings = await pool.query('SELECT key,value FROM catalogue_settings');
    const cfg = {};
    settings.rows.forEach(r => cfg[r.key]=r.value);

    const products = await pool.query(`
      SELECT p.id, p.name, p.category, p.condition, p.grade, p.color,
             COALESCE(p.catalogue_price, p.sale_price) as price,
             p.stock_quantity, p.catalogue_description,
             pp.filename as photo
      FROM products p
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, filename
        FROM product_photos
        ORDER BY product_id, sort_order, id
      ) pp ON pp.product_id = p.id
      WHERE p.catalogue_visible=true AND p.stock_quantity>0 AND p.statut_produit='DISPONIBLE'
      ORDER BY p.category, price DESC
    `);

    const services = await pool.query(`
      SELECT * FROM catalogue_services WHERE visible=true ORDER BY category, sort_order
    `);

    res.json({ settings: cfg, products: products.rows, services: services.rows });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Photos d'un produit (public — pour le modal catalogue)
app.get('/api/catalogue/products/:id/photos', async(req,res) => {
  try {
    const r = await pool.query(
      'SELECT filename FROM product_photos WHERE product_id=$1 ORDER BY sort_order,id',
      [req.params.id]
    );
    res.json(r.rows.map(x => x.filename));
  } catch(e){ res.status(500).json({error:e.message}); }
});

// QR code (retourne SVG inline)
app.get('/api/catalogue/qrcode', async(req,res) => {
  try {
    const QRCode = require('qrcode');
    const s = await pool.query("SELECT value FROM catalogue_settings WHERE key='catalogue_url'");
    const url = s.rows[0]?.value || `http://localhost:3000/catalogue`;
    const svg = await QRCode.toString(url, {type:'svg', margin:1});
    res.setHeader('Content-Type','image/svg+xml');
    res.send(svg);
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* =======================================================
   CATALOGUE ADMIN — AUTHENTIFICATION PAR MOT DE PASSE
======================================================= */
const crypto=require('crypto');
const CAT_ADMIN_PASS=process.env.CATALOGUE_ADMIN_PASS||'Smartphone@Admin2026';
// Token stable : change uniquement si le mot de passe change (persiste aux redémarrages)
const CAT_TOKEN=crypto.createHash('sha256').update(CAT_ADMIN_PASS+':cat-admin-v1').digest('hex');

function parseCookies(header){
  const c={};(header||'').split(';').forEach(p=>{const[k,v]=(p.trim()).split('=');if(k)c[k.trim()]=decodeURIComponent((v||'').trim());});return c;
}
function requireCatAdmin(req,res,next){
  const cookies=parseCookies(req.headers.cookie);
  if(cookies.cat_admin===CAT_TOKEN)return next();
  if((req.originalUrl||'').includes('/api/catalogue-admin'))
    return res.status(401).json({error:'Non authentifié. Connectez-vous sur /catalogue-admin'});
  res.redirect('/catalogue-admin-login');
}

const CAT_LOGIN_HTML=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Catalogue Admin — Connexion</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box;margin:0;padding:0;}
body{background:#0a0a0f;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.box{background:#1a1a24;border:1px solid #2a2a3a;border-radius:16px;padding:40px 32px;width:min(340px,90vw);text-align:center;}
.logo{font-size:28px;font-weight:900;margin-bottom:4px;}.logo span{color:#e8ff00;}
.sub{font-size:12px;color:#6b6b85;margin-bottom:28px;}
input{width:100%;padding:11px 14px;background:#13131a;border:1px solid #3a3a5a;border-radius:8px;color:#fff;font-size:14px;margin-bottom:14px;outline:0;}
input:focus{border-color:#e8ff00;}
button{width:100%;padding:13px;background:#e8ff00;color:#000;border:0;border-radius:9px;font-weight:700;cursor:pointer;font-size:14px;}
button:hover{opacity:.88;}.err{color:#ff6b6b;font-size:13px;margin-top:12px;}</style></head>
<body><div class="box">
<div class="logo">📱 <span>SMARTPHONE</span></div>
<div class="sub">Catalogue Admin — Accès sécurisé</div>
<form method="POST" action="/catalogue-admin-login">
<input type="password" name="password" placeholder="Mot de passe admin" autofocus autocomplete="current-password">
<button type="submit">🔒 Connexion</button>
</form>%ERR%
</div></body></html>`;

app.get('/catalogue-admin-login',(req,res)=>{
  res.send(CAT_LOGIN_HTML.replace('%ERR%',''));
});
app.post('/catalogue-admin-login',express.urlencoded({extended:false}),(req,res)=>{
  if((req.body.password||'')=== CAT_ADMIN_PASS){
    const exp=new Date(Date.now()+30*24*3600*1000).toUTCString();
    res.setHeader('Set-Cookie',`cat_admin=${CAT_TOKEN}; Path=/; HttpOnly; Expires=${exp}; SameSite=Strict`);
    res.redirect('/catalogue-admin');
  } else {
    res.status(401).send(CAT_LOGIN_HTML.replace('%ERR%','<div class="err">❌ Mot de passe incorrect</div>'));
  }
});
app.get('/catalogue-admin-logout',(req,res)=>{
  res.setHeader('Set-Cookie','cat_admin=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  res.redirect('/catalogue-admin-login');
});

/* =======================================================
   CATALOGUE ADMIN — gestion produits/services/settings
======================================================= */

// Page admin catalogue
app.get('/catalogue-admin', requireCatAdmin, (req,res) => {
  res.sendFile(path.join(__dirname,'catalogue-admin.html'));
});

// Protection middleware sur toutes les routes API admin
app.use('/api/catalogue-admin', requireCatAdmin);

// Lister tous les produits pour admin (avec filtre)
app.get('/api/catalogue-admin/products', async(req,res) => {
  try {
    const {search,category} = req.query;
    let sql = `SELECT id, name, category, condition, grade, color,
                      sale_price, catalogue_price, catalogue_visible,
                      stock_quantity, catalogue_description,
                      purchase_price, supplier_name,
                      (SELECT filename FROM product_photos WHERE product_id=p.id ORDER BY sort_order,id LIMIT 1) AS photo
               FROM products p WHERE statut_produit='DISPONIBLE'`;
    const p = [];
    if(search){ p.push('%'+search+'%'); sql+=` AND name ILIKE $${p.length}`; }
    if(category){ p.push(category); sql+=` AND category=$${p.length}`; }
    sql += ' ORDER BY catalogue_visible DESC, category, name LIMIT 200';
    const r = await pool.query(sql,p);
    res.json(r.rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Modifier un produit catalogue
app.patch('/api/catalogue-admin/products/:id', async(req,res) => {
  try {
    const {catalogue_visible, catalogue_price, stock_quantity, catalogue_description} = req.body;
    const fields = [], vals = [];
    if(catalogue_visible !== undefined){ vals.push(catalogue_visible); fields.push(`catalogue_visible=$${vals.length}`); }
    if(catalogue_price  !== undefined){ vals.push(catalogue_price);   fields.push(`catalogue_price=$${vals.length}`); }
    if(stock_quantity   !== undefined){ vals.push(stock_quantity);    fields.push(`stock_quantity=$${vals.length}`); }
    if(catalogue_description !== undefined){ vals.push(catalogue_description); fields.push(`catalogue_description=$${vals.length}`); }
    if(!fields.length) return res.json({ok:true});
    vals.push(req.params.id);
    await pool.query(`UPDATE products SET ${fields.join(',')} WHERE id=$${vals.length}`, vals);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Services catalogue (réparations, impression)
app.get('/api/catalogue-admin/services', async(req,res) => {
  try {
    const r = await pool.query('SELECT * FROM catalogue_services ORDER BY category, sort_order');
    res.json(r.rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/catalogue-admin/services/:id', async(req,res) => {
  try {
    const {name, price, price_market, delay, visible, sort_order} = req.body;
    const fields=[], vals=[];
    if(name         !== undefined){ vals.push(name);         fields.push(`name=$${vals.length}`); }
    if(price        !== undefined){ vals.push(price);        fields.push(`price=$${vals.length}`); }
    if(price_market !== undefined){ vals.push(price_market); fields.push(`price_market=$${vals.length}`); }
    if(delay        !== undefined){ vals.push(delay);        fields.push(`delay=$${vals.length}`); }
    if(visible      !== undefined){ vals.push(visible);      fields.push(`visible=$${vals.length}`); }
    if(sort_order   !== undefined){ vals.push(sort_order);   fields.push(`sort_order=$${vals.length}`); }
    if(!fields.length) return res.json({ok:true});
    vals.push(req.params.id);
    await pool.query(`UPDATE catalogue_services SET ${fields.join(',')} WHERE id=$${vals.length}`, vals);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/catalogue-admin/services', async(req,res) => {
  try {
    const {category,name,price,price_market,delay,sort_order} = req.body;
    const r = await pool.query(
      'INSERT INTO catalogue_services(category,name,price,price_market,delay,sort_order) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [category,name,price||0,price_market||null,delay||null,sort_order||0]
    );
    res.json(r.rows[0]);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/catalogue-admin/services/:id', async(req,res) => {
  try {
    await pool.query('DELETE FROM catalogue_services WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Settings catalogue
app.get('/api/catalogue-admin/settings', async(req,res) => {
  try {
    const r = await pool.query('SELECT key,value FROM catalogue_settings ORDER BY key');
    const cfg = {};
    r.rows.forEach(row => cfg[row.key]=row.value);
    res.json(cfg);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/catalogue-admin/settings', async(req,res) => {
  try {
    for(const [key,value] of Object.entries(req.body)){
      await pool.query(
        'INSERT INTO catalogue_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2',
        [key, value]
      );
    }
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* =======================================================
   PHOTOS PRODUITS
======================================================= */

/* Multer dédié aux photos produits (sous-dossier par produit) */
const photoStorage=multer.diskStorage({
  destination:(req,file,cb)=>{
    const dir=path.join(__dirname,'uploads','products',String(req.params.id));
    fs.mkdirSync(dir,{recursive:true});
    cb(null,dir);
  },
  filename:(req,file,cb)=>{
    const ext=path.extname(file.originalname).toLowerCase()||'.jpg';
    cb(null,Date.now()+'-'+Math.random().toString(36).substr(2,6)+ext);
  }
});
const uploadPhoto=multer({storage:photoStorage,limits:{fileSize:15*1024*1024},
  fileFilter:(req,file,cb)=>{
    const ok=['.jpg','.jpeg','.png','.webp','.gif'].includes(path.extname(file.originalname).toLowerCase());
    cb(null,ok);
  }
});

/* Servir les photos */
app.use('/uploads/products',express.static(path.join(__dirname,'uploads','products')));

/* Lister les photos d'un produit */
app.get('/api/catalogue-admin/products/:id/photos',requireCatAdmin,async(req,res)=>{
  try{
    const r=await pool.query(
      'SELECT * FROM product_photos WHERE product_id=$1 ORDER BY sort_order,id',
      [req.params.id]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

/* Upload une ou plusieurs photos (compressées côté client) */
app.post('/api/catalogue-admin/products/:id/photos',requireCatAdmin,uploadPhoto.array('photos',10),async(req,res)=>{
  try{
    if(!req.files||!req.files.length)return res.status(400).json({error:'Aucun fichier reçu'});
    const added=[];
    for(const f of req.files){
      /* sort_order = max existant + 1 */
      const r=await pool.query(
        `INSERT INTO product_photos(product_id,filename,sort_order)
         VALUES($1,$2,(SELECT COALESCE(MAX(sort_order),0)+1 FROM product_photos WHERE product_id=$1))
         RETURNING *`,
        [req.params.id,f.filename]);
      added.push(r.rows[0]);
    }
    res.json(added);
  }catch(e){res.status(500).json({error:e.message});}
});

/* Import depuis une URL (télécharge et sauvegarde) */
app.post('/api/catalogue-admin/products/:id/photos/from-url',requireCatAdmin,async(req,res)=>{
  const {url}=req.body;
  if(!url)return res.status(400).json({error:'URL manquante'});
  try{
    const dir=path.join(__dirname,'uploads','products',String(req.params.id));
    fs.mkdirSync(dir,{recursive:true});
    const filename=Date.now()+'-'+Math.random().toString(36).substr(2,6)+'.jpg';
    const filepath=path.join(dir,filename);

    /* Téléchargement avec suivi des redirections */
    await new Promise((resolve,reject)=>{
      function download(u,depth){
        if(depth>5)return reject(new Error('Trop de redirections'));
        const client=u.startsWith('https')?require('https'):require('http');
        client.get(u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; ShopBot/1.0)','Accept':'image/*,*/*'}},resp=>{
          if(resp.statusCode===301||resp.statusCode===302||resp.statusCode===303){
            return download(resp.headers.location,depth+1);
          }
          if(resp.statusCode!==200)return reject(new Error('HTTP '+resp.statusCode));
          const out=fs.createWriteStream(filepath);
          resp.pipe(out);
          out.on('finish',()=>out.close(resolve));
          out.on('error',reject);
        }).on('error',reject);
      }
      download(url,0);
    });

    const r=await pool.query(
      `INSERT INTO product_photos(product_id,filename,sort_order)
       VALUES($1,$2,(SELECT COALESCE(MAX(sort_order),0)+1 FROM product_photos WHERE product_id=$1))
       RETURNING *`,
      [req.params.id,filename]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

/* Supprimer une photo */
app.delete('/api/catalogue-admin/products/:id/photos/:photoId',requireCatAdmin,async(req,res)=>{
  try{
    const r=await pool.query('SELECT * FROM product_photos WHERE id=$1 AND product_id=$2',[req.params.photoId,req.params.id]);
    if(!r.rows[0])return res.status(404).json({error:'Photo introuvable'});
    const filepath=path.join(__dirname,'uploads','products',String(req.params.id),r.rows[0].filename);
    if(fs.existsSync(filepath))fs.unlinkSync(filepath);
    await pool.query('DELETE FROM product_photos WHERE id=$1',[req.params.photoId]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message});}
});

/* Réordonner les photos (drag & drop) */
app.put('/api/catalogue-admin/products/:id/photos/reorder',requireCatAdmin,async(req,res)=>{
  try{
    const {order}=req.body; /* [{id,sort_order}] */
    for(const item of order){
      await pool.query('UPDATE product_photos SET sort_order=$1 WHERE id=$2 AND product_id=$3',[item.sort_order,item.id,req.params.id]);
    }
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   ANALYTICS — Dashboard
======================================================= */
app.get('/api/analytics/overview', async(req,res)=>{
  try{
    const days = parseInt(req.query.days)||30;
    const since = new Date(); since.setDate(since.getDate()-days);
    const sinceStr = since.toISOString().split('T')[0];

    const [v,r,d,cr] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS nb, COALESCE(SUM(total),0) AS ca,
        COALESCE(SUM(CASE WHEN payment_method='card' THEN total WHEN COALESCE(amount_cb,0)>0 THEN amount_cb ELSE 0 END),0) AS cb,
        COALESCE(SUM(CASE WHEN payment_method='cash' THEN total WHEN COALESCE(amount_cash,0)>0 THEN amount_cash ELSE 0 END),0) AS esp,
        COALESCE(SUM(COALESCE(amount_credit,0)),0) AS credit
        FROM orders WHERE DATE(created_at)>=$1 AND (status IS NULL OR status!='cancelled')`, [sinceStr]),
      pool.query(`SELECT COUNT(*) AS nb, COALESCE(SUM(COALESCE(final_price,estimated_price,0)),0) AS ca,
        COALESCE(SUM(CASE WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) WHEN COALESCE(amount_cb,0)>0 THEN amount_cb ELSE 0 END),0) AS cb,
        COALESCE(SUM(CASE WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) WHEN COALESCE(amount_cash,0)>0 THEN amount_cash ELSE 0 END),0) AS esp
        FROM repairs WHERE DATE(created_at)>=$1`, [sinceStr]),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE DATE(date)>=$1`, [sinceStr]),
      pool.query(`SELECT COALESCE(SUM(amount_due),0) AS total FROM customer_credits WHERE status='EN_COURS'`)
    ]);
    res.json({
      ventes:    {nb:parseInt(v.rows[0].nb), ca:parseFloat(v.rows[0].ca), cb:parseFloat(v.rows[0].cb), esp:parseFloat(v.rows[0].esp), credit:parseFloat(v.rows[0].credit)},
      reparations:{nb:parseInt(r.rows[0].nb), ca:parseFloat(r.rows[0].ca), cb:parseFloat(r.rows[0].cb), esp:parseFloat(r.rows[0].esp)},
      depenses:  parseFloat(d.rows[0].total),
      credits_en_cours: parseFloat(cr.rows[0].total),
      days
    });
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/analytics/revenue-trend', async(req,res)=>{
  try{
    const days = parseInt(req.query.days)||30;
    const since = new Date(); since.setDate(since.getDate()-days);
    const sinceStr = since.toISOString().split('T')[0];
    const [v,r,d] = await Promise.all([
      pool.query(`SELECT DATE(created_at) AS jour, COALESCE(SUM(total),0) AS ca
        FROM orders WHERE DATE(created_at)>=$1 AND (status IS NULL OR status!='cancelled')
        GROUP BY jour ORDER BY jour`, [sinceStr]),
      pool.query(`SELECT DATE(COALESCE(delivered_at,created_at)) AS jour, COALESCE(SUM(COALESCE(final_price,estimated_price,0)),0) AS ca
        FROM repairs WHERE DATE(created_at)>=$1 AND status IN ('TERMINE','LIVRE')
        GROUP BY jour ORDER BY jour`, [sinceStr]),
      pool.query(`SELECT DATE(date) AS jour, COALESCE(SUM(amount),0) AS total
        FROM expenses WHERE DATE(date)>=$1 GROUP BY jour ORDER BY jour`, [sinceStr])
    ]);
    res.json({ventes:v.rows, reparations:r.rows, depenses:d.rows});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/analytics/payments', async(req,res)=>{
  try{
    const days = parseInt(req.query.days)||30;
    const since = new Date(); since.setDate(since.getDate()-days);
    const sinceStr = since.toISOString().split('T')[0];
    const [v,r] = await Promise.all([
      pool.query(`SELECT payment_method, COUNT(*) AS nb, COALESCE(SUM(total),0) AS ca
        FROM orders WHERE DATE(created_at)>=$1 AND (status IS NULL OR status!='cancelled')
        GROUP BY payment_method`, [sinceStr]),
      pool.query(`SELECT payment_method, COUNT(*) AS nb, COALESCE(SUM(COALESCE(final_price,estimated_price,0)),0) AS ca
        FROM repairs WHERE DATE(created_at)>=$1 GROUP BY payment_method`, [sinceStr])
    ]);
    res.json({ventes:v.rows, reparations:r.rows});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/analytics/top-products', async(req,res)=>{
  try{
    const days = parseInt(req.query.days)||30;
    const since = new Date(); since.setDate(since.getDate()-days);
    const sinceStr = since.toISOString().split('T')[0];
    const r = await pool.query(`
      SELECT COALESCE(p.name,'Produit supprimé') AS name, p.category,
        SUM(oi.quantity) AS qte, SUM(oi.quantity*(oi.price-COALESCE(oi.discount,0))) AS ca
      FROM order_items oi
      LEFT JOIN products p ON p.id=oi.product_id
      JOIN orders o ON o.id=oi.order_id
      WHERE DATE(o.created_at)>=$1 AND (o.status IS NULL OR o.status!='cancelled')
      GROUP BY p.name,p.category ORDER BY ca DESC LIMIT 10`, [sinceStr]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/analytics/expenses-by-cat', async(req,res)=>{
  try{
    const days = parseInt(req.query.days)||30;
    const since = new Date(); since.setDate(since.getDate()-days);
    const sinceStr = since.toISOString().split('T')[0];
    const r = await pool.query(`SELECT category, COALESCE(SUM(amount),0) AS total, COUNT(*) AS nb
      FROM expenses WHERE DATE(date)>=$1 GROUP BY category ORDER BY total DESC`, [sinceStr]);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/analytics/repairs-status', async(req,res)=>{
  try{
    const r = await pool.query(`SELECT status, COUNT(*) AS nb,
      COALESCE(SUM(COALESCE(final_price,estimated_price,0)),0) AS ca
      FROM repairs GROUP BY status ORDER BY nb DESC`);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/analytics/top-stats', async(req,res)=>{
  try{
    const days = parseInt(req.query.days)||30;
    const since = new Date(); since.setDate(since.getDate()-days);
    const sinceStr = since.toISOString().split('T')[0];
    const [topQty, topCA, topPhone, topIssue, topList] = await Promise.all([
      pool.query(`SELECT COALESCE(p.name,'Produit supprimé') AS name, SUM(oi.quantity) AS nb
        FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id
        JOIN orders o ON o.id=oi.order_id
        WHERE DATE(o.created_at)>=$1 AND (o.status IS NULL OR o.status!='cancelled')
        GROUP BY p.name ORDER BY nb DESC LIMIT 1`, [sinceStr]),
      pool.query(`SELECT COALESCE(p.name,'Produit supprimé') AS name, SUM(oi.quantity*(oi.price-COALESCE(oi.discount,0))) AS ca
        FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id
        JOIN orders o ON o.id=oi.order_id
        WHERE DATE(o.created_at)>=$1 AND (o.status IS NULL OR o.status!='cancelled')
        GROUP BY p.name ORDER BY ca DESC LIMIT 1`, [sinceStr]),
      pool.query(`SELECT TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')) AS phone, COUNT(*) AS nb
        FROM repairs WHERE DATE(created_at)>=$1 AND TRIM(COALESCE(brand,'')||' '||COALESCE(model,''))!=''
        GROUP BY TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')) ORDER BY nb DESC LIMIT 1`, [sinceStr]),
      pool.query(`SELECT issue, COUNT(*) AS nb FROM repairs
        WHERE DATE(created_at)>=$1 AND issue IS NOT NULL AND issue!=''
        GROUP BY issue ORDER BY nb DESC LIMIT 1`, [sinceStr]),
      pool.query(`SELECT COALESCE(p.name,'Produit supprimé') AS name, SUM(oi.quantity) AS qte,
        SUM(oi.quantity*(oi.price-COALESCE(oi.discount,0))) AS ca
        FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id
        JOIN orders o ON o.id=oi.order_id
        WHERE DATE(o.created_at)>=$1 AND (o.status IS NULL OR o.status!='cancelled')
        GROUP BY p.name ORDER BY ca DESC LIMIT 5`, [sinceStr])
    ]);
    res.json({
      top_qty:   topQty.rows[0]||null,
      top_ca:    topCA.rows[0]||null,
      top_phone: topPhone.rows[0]||null,
      top_issue: topIssue.rows[0]||null,
      top_list:  topList.rows
    });
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/analytics/monthly', async(req,res)=>{
  try{
    const [v,r,d] = await Promise.all([
      pool.query(`SELECT TO_CHAR(created_at,'YYYY-MM') AS mois, COALESCE(SUM(total),0) AS ca, COUNT(*) AS nb
        FROM orders WHERE (status IS NULL OR status!='cancelled')
        AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY mois ORDER BY mois`),
      pool.query(`SELECT TO_CHAR(created_at,'YYYY-MM') AS mois, COALESCE(SUM(COALESCE(final_price,estimated_price,0)),0) AS ca, COUNT(*) AS nb
        FROM repairs WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY mois ORDER BY mois`),
      pool.query(`SELECT TO_CHAR(date,'YYYY-MM') AS mois, COALESCE(SUM(amount),0) AS total
        FROM expenses WHERE date >= NOW() - INTERVAL '12 months'
        GROUP BY mois ORDER BY mois`)
    ]);
    res.json({ventes:v.rows, reparations:r.rows, depenses:d.rows});
  }catch(e){res.status(500).json({error:e.message});}
});

/* =======================================================
   WHATSAPP — status, QR, test
======================================================= */
app.get('/api/whatsapp/status',(req,res)=>{
  res.json({
    status: waClient.getStatus(),
    qr:     waClient.getQR(),
    to:     process.env.WA_TO ? '+'+process.env.WA_TO : null
  });
});

app.get('/api/whatsapp/groups',async(req,res)=>{
  try{
    const chats = await waClient.getClient().getChats();
    const groups = chats
      .filter(c=>c.isGroup)
      .map(c=>({id:c.id._serialized, name:c.name, participants:c.participants?.length||0}));
    res.json(groups);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/whatsapp/test',async(req,res)=>{
  try{
    const to=process.env.WA_TO;
    if(!to)return res.status(400).json({error:'WA_TO non configuré dans .env'});
    await waClient.sendReport(to,
      '✅ Test WhatsApp — The SMARTPHONE\nLe rapport automatique est bien configuré 🎉');
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message});}
});

app.listen(3000,()=>{
  console.log('🚀 The SMARTPHONE POS — http://localhost:3000');
  /* Démarrer WhatsApp en arrière-plan */
  try{ waClient.initWhatsApp(); }catch(e){ console.error('[WhatsApp] Erreur démarrage:',e.message); }
});
