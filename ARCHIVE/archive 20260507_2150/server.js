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

/* ================= SEARCH ================= */
app.get('/api/repairs/search', async (req, res) => {
  try {
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
      LIMIT 50
    `, [`%${q}%`]);

    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= CREATE ================= */
app.post('/api/repairs', async (req, res) => {
  try {
    const r = await pool.query(`
      INSERT INTO repairs(
        customer_name, phone, device_type, brand, model,
        serial_number, issue, estimated_price, comment, status, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EN_ATTENTE',NOW())
      RETURNING *
    `, [
      req.body.customer_name || '',
      req.body.phone || '',
      req.body.device_type || '',
      req.body.brand || '',
      req.body.model || '',
      req.body.serial_number || '',
      req.body.issue || '',
      Number(req.body.estimated_price || 0),
      req.body.comment || ''
    ]);

    res.json(r.rows[0]);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* ================= LIST ================= */
app.get('/api/repairs', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT *
      FROM repairs
      ORDER BY id DESC
    `);

    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= GET ONE ================= */
app.get('/api/repairs/:id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT *
      FROM repairs
      WHERE id=$1
    `, [req.params.id]);

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= UPDATE (FIX FINAL) ================= */
app.put('/api/repairs/:id', async (req, res) => {
  try {

    const status = String(req.body.status || 'EN_ATTENTE');
    const final_price = Number(req.body.final_price || 0);

    console.log("➡️ UPDATE REPAIR:", req.params.id, { status, final_price });

    const r = await pool.query(`
      UPDATE repairs
      SET
        status = $1,
        final_price = $2,
        updated_at = NOW(),
        delivered_at = CASE
          WHEN $1 = 'TERMINE' THEN NOW()
          ELSE delivered_at
        END
      WHERE id = $3
      RETURNING *
    `, [status, final_price, req.params.id]);

    res.json(r.rows[0]);

  } catch (e) {
    console.error("❌ UPDATE ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => {
  console.log("🚀 POS running http://localhost:3000");
});