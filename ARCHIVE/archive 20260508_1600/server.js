const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'shop_db',
  password: 'Sempac',
  port: 5432,
});

/* =======================================================
   GET ALL PRODUCTS
======================================================= */
app.get('/api/products', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        id,
        name,
        category,
        sale_price  AS price,
        stock_quantity,
        barcode,
        supplier_id
      FROM products
      ORDER BY name ASC
    `);
    res.json(r.rows);
  } catch (e) {
    console.error("❌ GET PRODUCTS:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   CREATE ORDER (vente)
======================================================= */
app.post('/api/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    const { cart, payment, customer } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, error: 'Panier vide' });
    }

    const total = cart.reduce((sum, item) => {
      return sum + (Number(item.price) * Number(item.qty)) - (Number(item.discount || 0) * Number(item.qty));
    }, 0);

    await client.query('BEGIN');

    const orderResult = await client.query(`
      INSERT INTO orders (total, payment_method, customer_name, status, created_at)
      VALUES ($1, $2, $3, 'completed', NOW())
      RETURNING id
    `, [
      total.toFixed(2),
      payment || 'cash',
      customer || ''
    ]);

    const orderId = orderResult.rows[0].id;

    for (const item of cart) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, price, discount)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        orderId,
        item.id,
        item.qty,
        Number(item.price),
        Number(item.discount || 0)
      ]);

      await client.query(`
        UPDATE products
        SET stock_quantity = stock_quantity - $1
        WHERE id = $2
      `, [item.qty, item.id]);
    }

    await client.query('COMMIT');

    console.log(`✅ ORDER #${orderId} — ${total.toFixed(2)} €`);
    res.json({ success: true, orderId });

  } catch (e) {
    await client.query('ROLLBACK');
    console.error("❌ CREATE ORDER:", e);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

/* =======================================================
   GET ONE ORDER + ITEMS
======================================================= */
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await pool.query(`
      SELECT * FROM orders WHERE id = $1
    `, [req.params.id]);

    const items = await pool.query(`
      SELECT
        oi.id,
        oi.order_id,
        oi.quantity,
        oi.price,
        oi.discount,
        p.name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `, [req.params.id]);

    res.json({
      order: order.rows[0],
      items: items.rows
    });
  } catch (e) {
    console.error("❌ GET ORDER:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   SEARCH ORDERS (par date)
======================================================= */
app.get('/api/orders/search', async (req, res) => {
  try {
    console.log("➡️ GET /api/orders/search", req.query);

    const date_min = req.query.date_min || '2000-01-01';
    const date_max = req.query.date_max || '2999-12-31';

    const r = await pool.query(`
      SELECT *
      FROM orders
      WHERE DATE(created_at) BETWEEN $1 AND $2
      ORDER BY id DESC
    `, [date_min, date_max]);

    res.json(r.rows);
  } catch (e) {
    console.error("❌ SEARCH ORDERS:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   DAILY REPORT
======================================================= */
app.get('/api/daily-report', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const ventesResult = await pool.query(`
      SELECT
        o.id,
        o.payment_method,
        o.total,
        STRING_AGG(DISTINCT p.name, ', ')  AS designation,
        MAX(s.name)                         AS fournisseur
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p     ON p.id = oi.product_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE DATE(o.created_at) = $1
        AND (o.status IS NULL OR o.status != 'cancelled')
      GROUP BY o.id, o.payment_method, o.total
      ORDER BY o.id DESC
    `, [date]);

    const repsResult = await pool.query(`
      SELECT
        id,
        TRIM(
          COALESCE(brand, '') || ' ' ||
          COALESCE(model, '') || ' ' ||
          COALESCE(device_type, '')
        )                                          AS designation,
        payment_method,
        COALESCE(final_price, estimated_price, 0)  AS total
      FROM repairs
      WHERE DATE(created_at) = $1
        AND status IN ('TERMINE', 'LIVRE')
      ORDER BY id DESC
    `, [date]);

    const totV = await pool.query(`
      SELECT
        COUNT(*)                                                         AS nb_ventes,
        COALESCE(SUM(total), 0)                                          AS grand_total,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('cb','card','carte') THEN total ELSE 0 END), 0) AS total_cb,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('especes','cash','esp','espèces') THEN total ELSE 0 END), 0) AS total_esp
      FROM orders
      WHERE DATE(created_at) = $1
        AND (status IS NULL OR status != 'cancelled')
    `, [date]);

    const totR = await pool.query(`
      SELECT
        COUNT(*)                                                                                          AS nb_reps,
        COALESCE(SUM(COALESCE(final_price, estimated_price, 0)), 0)                                      AS grand_total,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('cb','card','carte') THEN COALESCE(final_price, estimated_price, 0) ELSE 0 END), 0) AS total_cb,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('especes','cash','esp','espèces') THEN COALESCE(final_price, estimated_price, 0) ELSE 0 END), 0) AS total_esp
      FROM repairs
      WHERE DATE(created_at) = $1
        AND status IN ('TERMINE', 'LIVRE')
    `, [date]);

    const totDep = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_depenses
      FROM expenses
      WHERE DATE(date) = $1
    `, [date]);

    res.json({
      date,
      ventes:             ventesResult.rows,
      reparations:        repsResult.rows,
      totaux_ventes:      totV.rows[0],
      totaux_reparations: totR.rows[0],
      total_depenses:     parseFloat(totDep.rows[0].total_depenses),
    });

  } catch (e) {
    console.error('❌ DAILY REPORT:', e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   SEARCH REPAIRS
======================================================= */
app.get('/api/repairs/search', async (req, res) => {
  try {
    console.log("➡️ GET /api/repairs/search", req.query);

    const q = req.query.q || '';

    const r = await pool.query(`
      SELECT *
      FROM repairs
      WHERE
        CAST(id AS TEXT) ILIKE $1
        OR customer_name ILIKE $1
        OR phone ILIKE $1
        OR brand ILIKE $1
        OR model ILIKE $1
      ORDER BY id DESC
      LIMIT 100
    `, [`%${q}%`]);

    res.json(r.rows);
  } catch (e) {
    console.error("❌ SEARCH REPAIRS:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   CREATE REPAIR
======================================================= */
app.post('/api/repairs', async (req, res) => {
  try {
    const r = await pool.query(`
      INSERT INTO repairs(
        customer_name,
        phone,
        device_type,
        brand,
        model,
        serial_number,
        issue,
        estimated_price,
        comment,
        status,
        created_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'EN_ATTENTE',NOW())
      RETURNING *
    `, [
      req.body.customer_name || '',
      req.body.phone         || '',
      req.body.device_type   || '',
      req.body.brand         || '',
      req.body.model         || '',
      req.body.serial_number || '',
      req.body.issue         || '',
      Number(req.body.estimated_price || 0),
      req.body.comment       || ''
    ]);

    res.json(r.rows[0]);
  } catch (e) {
    console.error("❌ CREATE REPAIR:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   LIST REPAIRS
======================================================= */
app.get('/api/repairs', async (req, res) => {
  try {
    console.log("➡️ GET /api/repairs");

    const r = await pool.query(`
      SELECT * FROM repairs ORDER BY id DESC
    `);

    res.json(r.rows);
  } catch (e) {
    console.error("❌ LIST REPAIRS:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   GET ONE REPAIR
======================================================= */
app.get('/api/repairs/:id', async (req, res) => {
  try {
    console.log("➡️ GET /api/repairs/" + req.params.id);

    const r = await pool.query(`
      SELECT * FROM repairs WHERE id = $1
    `, [req.params.id]);

    res.json(r.rows[0]);
  } catch (e) {
    console.error("❌ GET REPAIR:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   UPDATE REPAIR
======================================================= */
app.put('/api/repairs/:id', async (req, res) => {
  try {
    const status      = String(req.body.status || 'EN_ATTENTE');
    const final_price = Number(req.body.final_price || 0);

    console.log("➡️ UPDATE REPAIR:", req.params.id, { status, final_price });

    const r = await pool.query(`
      UPDATE repairs
      SET
        status      = CAST($1 AS varchar),
        final_price = $2,
        updated_at  = NOW(),
        delivered_at = CASE
          WHEN CAST($1 AS varchar) = 'TERMINE' THEN NOW()
          ELSE delivered_at
        END
      WHERE id = $3
      RETURNING *
    `, [status, final_price, req.params.id]);

    res.json(r.rows[0]);
  } catch (e) {
    console.error("❌ UPDATE REPAIR:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   START SERVER
======================================================= */
app.listen(3000, '0.0.0.0', () => {
  console.log("🚀 POS running on network port 3000");
});