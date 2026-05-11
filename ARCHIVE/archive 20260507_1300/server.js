const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ================= LOG MIDDLEWARE =================
app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

// ================= DB =================
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'shop_db',
  password: 'Sempac',
  port: 5432,
});

// ================= PRODUCTS =================
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name,
      COALESCE(sale_price,0)::float AS price,
      COALESCE(stock_quantity,0) AS stock,
      barcode
      FROM products
      ORDER BY name
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "products error" });
  }
});

// ================= CREATE ORDER =================
app.post('/api/orders', async (req, res) => {

  const { cart, payment } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const total = cart.reduce((sum, p) => {
      return sum + (p.price * p.qty) - ((p.discount || 0) * p.qty);
    }, 0);

    const orderResult = await client.query(
      `INSERT INTO orders (total, payment_method)
       VALUES ($1,$2)
       RETURNING id`,
      [total, payment || 'unknown']
    );

    const orderId = orderResult.rows[0].id;

    for (const item of cart) {

      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1
         WHERE id=$2`,
        [item.qty, item.id]
      );

      await client.query(
        `INSERT INTO order_items
        (order_id, product_id, quantity, price, discount)
        VALUES ($1,$2,$3,$4,$5)`,
        [
          orderId,
          item.id,
          item.qty,
          item.price,
          item.discount || 0
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, orderId, total });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });

  } finally {
    client.release();
  }
});

// =====================================================
// 🔥 SEARCH (DOIT ÊTRE AVANT /:id)
// =====================================================
app.get('/api/orders/search', async (req, res) => {

  try {

    const { id, dateMin, dateMax, min, max, payment } = req.query;

    console.log("🔎 SEARCH:", req.query);

    let q = `
      SELECT id, total, payment_method, created_at
      FROM orders
      WHERE 1=1
    `;

    const params = [];

    // ===== ID =====
    if (id) {
      params.push(Number(id));
      q += ` AND id = $${params.length}`;
    }

    // ===== DATE RANGE (TIMESTAMP SAFE) =====
    if (dateMin && dateMax) {
      params.push(dateMin + " 00:00:00");
      params.push(dateMax + " 23:59:59");

      q += ` AND created_at BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    if (dateMin && !dateMax) {
      params.push(dateMin + " 00:00:00");
      q += ` AND created_at >= $${params.length}`;
    }

    if (!dateMin && dateMax) {
      params.push(dateMax + " 23:59:59");
      q += ` AND created_at <= $${params.length}`;
    }

    // ===== TOTAL =====
    if (min) {
      params.push(Number(min));
      q += ` AND total >= $${params.length}`;
    }

    if (max) {
      params.push(Number(max));
      q += ` AND total <= $${params.length}`;
    }

    // ===== PAYMENT =====
    if (payment) {
      params.push(payment);
      q += ` AND payment_method = $${params.length}`;
    }

    q += ` ORDER BY created_at DESC LIMIT 50`;

    console.log("SQL =>", q);
    console.log("PARAMS =>", params);

    const result = await pool.query(q, params);

    res.json(result.rows);

  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 🔥 GET ORDER (DOIT ÊTRE APRÈS SEARCH)
// =====================================================
app.get('/api/orders/:id', async (req, res) => {

  try {

    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }

    const order = await pool.query(
      `SELECT * FROM orders WHERE id=$1`,
      [id]
    );

    if (!order.rows.length)
      return res.status(404).json({ error: "not found" });

    const items = await pool.query(
      `SELECT oi.*, p.name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id=$1`,
      [id]
    );

    res.json({
      order: order.rows[0],
      items: items.rows
    });

  } catch (err) {
    console.error("GET ORDER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
app.listen(3000, () => {
  console.log("🚀 POS running http://localhost:3000");
});