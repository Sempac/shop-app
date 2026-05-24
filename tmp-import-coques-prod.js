require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432
});

// Données extraites de inventaire_coques.xlsx
const COQUES = [
  { name: 'Coque iPhone 17 Pro',               qty: 4  },
  { name: 'Coque iPhone 17',                   qty: 5  },
  { name: 'Coque iPhone 17 Pro Max',           qty: 10 },
  { name: 'Coque iPhone 17R',                  qty: 4  },
  { name: 'Coque iPhone 16 Plus',              qty: 3  },
  { name: 'Coque iPhone 16 Pro',               qty: 7  },
  { name: 'Coque iPhone 16 Pro Max',           qty: 11 },
  { name: 'Coque iPhone 16',                   qty: 6  },
  { name: 'Coque iPhone 15 Plus',              qty: 4  },
  { name: 'Coque iPhone 15 Pro',               qty: 7  },
  { name: 'Coque iPhone 15 Pro Max',           qty: 8  },
  { name: 'Coque iPhone 15',                   qty: 5  },
  { name: 'Coque iPhone 14 Pro Max',           qty: 12 },
  { name: 'Coque iPhone 14 Pro',               qty: 4  },
  { name: 'Coque iPhone 14 Plus',              qty: 8  },
  { name: 'Coque iPhone 14',                   qty: 5  },
  { name: 'Coque iPhone 13 Pro Max',           qty: 7  },
  { name: 'Coque iPhone 13 Pro',               qty: 8  },
  { name: 'Coque iPhone 13',                   qty: 8  },
  { name: 'Coque iPhone 12 Pro Max',           qty: 7  },
  { name: 'Coque iPhone 12 Pro',               qty: 11 },
  { name: 'Coque iPhone 12',                   qty: 5  },
  { name: 'Coque iPhone 11 Pro Max',           qty: 7  },
  { name: 'Coque iPhone 11 Pro',               qty: 7  },
  { name: 'Coque iPhone 11',                   qty: 4  },
  { name: 'Coque iPhone 12 Mini',              qty: 1  },
  { name: 'Coque iPhone 13 Mini',              qty: 2  },
  { name: 'Coque iPhone XR',                   qty: 4  },
  { name: 'Coque iPhone 8',                    qty: 6  },
  { name: 'Coque iPhone XS Max',               qty: 13 },
  { name: 'Coque iPhone XS',                   qty: 7  },
  { name: 'Coque iPhone 6 Plus',               qty: 8  },
  { name: 'Coque iPhone 7 Plus / 8 Plus',      qty: 11 },
  { name: 'Coque avec pochette IPhone XR',     qty: 3  },
  { name: 'Coque avec pochette IPhone 12 Pro Max', qty: 5 },
  { name: 'Coque avec pochette IPhone 11',     qty: 4  },
  { name: 'Coque avec pochette IPhone 11 Pro', qty: 4  },
  { name: 'Coque avec pochette IPhone 15',     qty: 1  },
  { name: 'Coque avec pochette IPhone 15 Pro', qty: 1  },
  { name: 'Coque avec pochette IPhone 15 Plus',qty: 1  },
  { name: 'Coque avec pochette IPhone 16',     qty: 2  },
  { name: 'Coque avec pochette IPhone 16 Pro Max', qty: 2 },
  { name: 'Coque avec pochette IPhone 16 Plus',qty: 1  },
  { name: 'Coque Samsung Galaxy S20',          qty: 2  },
  { name: 'Coque Samsung Galaxy S20 FE',       qty: 5  },
  { name: 'Coque Samsung Galaxy S21 Plus',     qty: 2  },
  { name: 'Coque Samsung Galaxy S21 Ultra',    qty: 2  },
  { name: 'Coque Samsung Galaxy S21 FE',       qty: 2  },
  { name: 'Coque Samsung Galaxy S22',          qty: 3  },
  { name: 'Coque Samsung Galaxy S22 Plus',     qty: 1  },
  { name: 'Coque Samsung Galaxy S22 Ultra',    qty: 5  },
  { name: 'Coque Samsung Galaxy S23 SE',       qty: 2  },
  { name: 'Coque Samsung Galaxy S23 Plus',     qty: 2  },
  { name: 'Coque Samsung Galaxy S23',          qty: 2  },
  { name: 'Coque Samsung Galaxy S23 Ultra',    qty: 3  },
];

(async () => {
  let updated = 0, inserted = 0;

  for (const item of COQUES) {
    const existing = await pool.query(
      'SELECT id, name, stock_quantity FROM products WHERE name ILIKE $1 LIMIT 1',
      [item.name]
    );

    if (existing.rows.length > 0) {
      const prod = existing.rows[0];
      await pool.query(
        `UPDATE products SET
          stock_quantity  = $1,
          color           = 'Noir',
          supplier_name   = 'LCD Phone',
          sale_price      = 25,
          catalogue_price = 25,
          statut_produit  = 'DISPONIBLE',
          condition       = 'NEUF',
          type_entree     = 'Commande fournisseur',
          category        = 'Coque',
          updated_at      = NOW()
        WHERE id = $2`,
        [item.qty, prod.id]
      );
      console.log('✏️  MAJ  [id='+prod.id+'] "'+prod.name+'" : '+prod.stock_quantity+' → '+item.qty+' pcs');
      updated++;
    } else {
      const ins = await pool.query(
        `INSERT INTO products
          (name, category, condition, color, sale_price, catalogue_price,
           stock_quantity, statut_produit, supplier_name, type_entree, updated_at)
         VALUES ($1, 'Coque', 'NEUF', 'Noir', 25, 25, $2, 'DISPONIBLE', 'LCD Phone', 'Commande fournisseur', NOW())
         RETURNING id`,
        [item.name, item.qty]
      );
      console.log('✅ INSÉRÉ [id='+ins.rows[0].id+'] "'+item.name+'" : '+item.qty+' pcs');
      inserted++;
    }
  }

  console.log('\n=== RÉSULTAT ===');
  console.log('  Mises à jour : '+updated);
  console.log('  Insertions   : '+inserted);
  console.log('  Total traité : '+COQUES.length);

  await pool.end();
})();
