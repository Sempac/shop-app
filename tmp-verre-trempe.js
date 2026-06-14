require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shop_db',
  password: process.env.DB_PASSWORD || 'Sempac',
  port: Number(process.env.DB_PORT) || 5432
});

async function run() {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // ── MISES À JOUR ──
    const updates = [
      { id: 127, qty: 2,  label: 'iPhone 11 / XR' },
      { id: 128, qty: 7,  label: 'iPhone 12 / 12 Pro' },
      { id: 346, qty: 5,  label: 'iPhone 12 Pro Max' },
      { id: 129, qty: 1,  label: 'iPhone 13 / 13 Pro' },
      { id: 130, qty: 8,  label: 'iPhone 14' },
      { id: 549, qty: 12, label: 'iPhone 14 Pro Max' },
      { id: 131, qty: 9,  label: 'iPhone 15 (split 9/10)' },
      { id: 573, qty: 2,  label: 'iPhone 15 Pro' },
      { id: 132, qty: 10, label: 'iPhone 16 (split 9/10)' },
      { id: 537, qty: 10, label: 'iPhone 16 Plus' },
      { id: 456, qty: 4,  label: 'iPhone 16 Pro (garde id 456)' },
      { id: 579, qty: 0,  label: 'iPhone 16 Pro doublon → 0' },
      { id: 580, qty: 0,  label: 'iPhone 16 Pro doublon → 0' },
      { id: 550, qty: 8,  label: 'iPhone 17 Pro Max' },
    ];

    for (const u of updates) {
      await client.query(
        'UPDATE products SET stock_quantity=$1, updated_at=NOW() WHERE id=$2',
        [u.qty, u.id]
      );
      console.log(`  UPDATE id ${u.id} → qty ${u.qty}  (${u.label})`);
    }

    // ── CRÉATIONS ──
    const creates = [
      { name: 'Verre trempé iPhone 12 mini',            qty: 4  },
      { name: 'Verre trempé iPhone 13 mini',            qty: 5  },
      { name: 'Verre trempé iPhone 13 Pro Max',         qty: 2  },
      { name: 'Verre trempé iPhone 14 Pro',             qty: 10 },
      { name: 'Verre trempé iPhone 15 Plus',            qty: 2  },
      { name: 'Verre trempé iPhone 15 Pro Max',         qty: 7  },
      { name: 'Verre trempé iPhone 17',                 qty: 2  },
      { name: 'Verre trempé iPhone 17 Air',             qty: 3  },
      { name: 'Verre trempé iPhone 17 Pro',             qty: 5  },
      { name: 'Verre trempé iPhone X / XS / 11 Pro',   qty: 5  },
      { name: 'Verre trempé iPhone 11 Pro Max / XS Max', qty: 7 },
    ];

    for (const c of creates) {
      const r = await client.query(
        `INSERT INTO products(name, category, stock_quantity, statut_produit)
         VALUES($1, 'Protection écran', $2, 'DISPONIBLE') RETURNING id`,
        [c.name, c.qty]
      );
      console.log(`  CREATE id ${r.rows[0].id} → "${c.name}" qty ${c.qty}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Intégration terminée.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ ROLLBACK:', e.message);
  } finally {
    client.release();
    await p.end();
  }
}

run();
