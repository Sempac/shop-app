const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use((req,res,next)=>{
  console.log("➡️", req.method, req.url);
  next();
});

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'shop_db',
  password: 'Sempac',
  port: 5432,
});

/* ================= PRODUCTS ================= */

app.get('/api/products', async (req,res)=>{

  try{

    const r = await pool.query(`
      SELECT id,name,
      COALESCE(sale_price,0)::float AS price,
      COALESCE(stock_quantity,0) AS stock,
      barcode
      FROM products
      ORDER BY name
    `);

    res.json(r.rows);

  }catch(e){
    console.error("PRODUCT ERROR:", e);
    res.status(500).json({error:e.message});
  }
});

/* ================= ORDERS SEARCH ================= */

app.get('/api/orders/search', async (req,res)=>{

  try{

    const {
      id,
      date_min,
      date_max,
      min,
      max,
      payment,
      customer
    } = req.query;

    let q = `
      SELECT id,total,payment_method,customer_name,created_at
      FROM orders
      WHERE 1=1
    `;

    const p = [];

    if(id){
      p.push(Number(id));
      q += ` AND id=$${p.length}`;
    }

    if(date_min){
      p.push(date_min);
      q += ` AND created_at >= $${p.length}::timestamp`;
    }

    if(date_max){
      p.push(date_max + ' 23:59:59');
      q += ` AND created_at <= $${p.length}::timestamp`;
    }

    if(min){
      p.push(Number(min));
      q += ` AND total >= $${p.length}`;
    }

    if(max){
      p.push(Number(max));
      q += ` AND total <= $${p.length}`;
    }

    if(payment){
      p.push(payment);
      q += ` AND payment_method=$${p.length}`;
    }

    if(customer){
      p.push('%'+customer+'%');
      q += ` AND customer_name ILIKE $${p.length}`;
    }

    q += ` ORDER BY created_at DESC LIMIT 100`;

    const r = await pool.query(q,p);

    res.json(r.rows);

  }catch(e){
    console.error("SEARCH ERROR:", e);
    res.status(500).json({error:e.message});
  }
});

/* ================= DAILY REPORT (FIX FINAL PROPRE) ================= */
app.get('/api/orders/daily-report', async (req,res)=>{

  try{

    const date =
      req.query.date ||
      new Date().toISOString().slice(0,10);

    console.log("📊 DAILY REPORT DATE:", date);

    // ================= ITEMS (produits) =================
    const itemsResult = await pool.query(`

      SELECT
        p.name AS product,
        COALESCE(s.name,'UNKNOWN') AS supplier,

        SUM(COALESCE(oi.quantity,0)) AS quantity,

        SUM(
          COALESCE(oi.price,0) * COALESCE(oi.quantity,0)
          -
          COALESCE(oi.discount,0) * COALESCE(oi.quantity,0)
        ) AS total

      FROM orders o

      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id

      WHERE o.created_at::date = $1::date
      AND o.status = 'VALID'
      GROUP BY p.name, s.name
      ORDER BY p.name

    `,[date]);

    // ================= ORDERS RAW =================
    const ordersResult = await pool.query(`

      SELECT
        total,
        payment_method
      FROM orders
      WHERE created_at::date = $1::date

    `,[date]);

    // ================= KPI CALC =================

    let totalDay = 0;
    let cb = 0;
    let cash = 0;

    for(const o of ordersResult.rows){

      const t = Number(o.total || 0);
      totalDay += t;

      const pm = (o.payment_method || '').toLowerCase();

      if(pm.includes('card') || pm.includes('cb')){
        cb += t;
      }else{
        cash += t;
      }
    }

    // ================= DEPENSES (si table existe) =================
    let expenses = 0;

    try{

      const exp = await pool.query(`
        SELECT COALESCE(SUM(amount),0) AS total
        FROM expenses
        WHERE created_at::date = $1::date
      `,[date]);

      expenses = Number(exp.rows[0].total || 0);

    }catch(e){
      console.log("⚠️ expenses table not found, default 0");
    }

    // ================= RESPONSE =================

    res.json({
      date,

      items: itemsResult.rows,

      summary: {
        total_sales: totalDay,
        cb: cb,
        cash: cash,
        expenses: expenses
      }
    });

  }catch(e){

    console.error("❌ DAILY REPORT ERROR:", e);

    res.status(500).json({
      error: e.message
    });
  }

});

/* ================= GET ORDER ================= */

app.get('/api/orders/:id', async (req,res)=>{

  try{

    const order = await pool.query(`

      SELECT *
      FROM orders
      WHERE id=$1

    `,[req.params.id]);

    if(!order.rows.length){

      return res.status(404).json({
        error:"not found"
      });
    }

    const items = await pool.query(`

      SELECT
        oi.*,
        p.name

      FROM order_items oi

      LEFT JOIN products p
        ON p.id = oi.product_id

      WHERE oi.order_id=$1

    `,[req.params.id]);

    res.json({
      order: order.rows[0],
      items: items.rows
    });

  }catch(e){

    console.error("GET ORDER ERROR:", e);

    res.status(500).json({
      error:e.message
    });
  }
});

/* ================= ORDERS ================= */

app.post('/api/orders', async (req,res)=>{

  const {cart,payment,customer} = req.body;

  const client = await pool.connect();

  try{

    await client.query('BEGIN');

    const total = cart.reduce((s,p)=>{
      return s + (p.price*p.qty) - (p.discount*p.qty || 0);
    },0);

    const r = await client.query(`
      INSERT INTO orders(total,payment_method,customer_name)
      VALUES ($1,$2,$3)
      RETURNING id
    `,[total,payment||'card',customer||'CLIENT']);

    const orderId = r.rows[0].id;

    for(const i of cart){

      await client.query(`
        INSERT INTO order_items
        (order_id,product_id,quantity,price,discount)
        VALUES ($1,$2,$3,$4,$5)
      `,[
        orderId,
        i.id,
        i.qty,
        i.price,
        i.discount||0
      ]);
    }

    await client.query('COMMIT');

    res.json({success:true,orderId,total});

  }catch(e){

    await client.query('ROLLBACK');
    console.error("ORDER ERROR:", e);
    res.status(500).json({error:e.message});

  }finally{
    client.release();
  }
});

/* ================= START ================= */

app.listen(3000,()=>{
  console.log("🚀 POS running http://localhost:3000");
});