require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432
});

const EXCEL = path.join('C:/Users/sempa/Downloads/inventaire_coques.xlsx');

(async () => {
  const wb = XLSX.readFile(EXCEL);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  let updated = 0, inserted = 0;

  for (const row of rows) {
    const name = String(row['Produit']).trim();
    const qty  = Number(row['Nombre de pièces']) || 0;

    // Check if product already exists (case-insensitive)
    const existing = await pool.query(
      'SELECT id, name, stock_quantity FROM products WHERE name ILIKE $1 LIMIT 1',
      [name]
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
        [qty, prod.id]
      );
      console.log(`✏️  MAJ  [id=${prod.id}] "${prod.name}" : ${prod.stock_quantity} → ${qty} pcs`);
      updated++;
    } else {
      const ins = await pool.query(
        `INSERT INTO products
          (name, category, condition, color, sale_price, catalogue_price,
           stock_quantity, statut_produit, supplier_name, type_entree, updated_at)
         VALUES ($1, 'Coque', 'NEUF', 'Noir', 25, 25, $2, 'DISPONIBLE', 'LCD Phone', 'Commande fournisseur', NOW())
         RETURNING id`,
        [name, qty]
      );
      console.log(`✅ INSÉRÉ [id=${ins.rows[0].id}] "${name}" : ${qty} pcs`);
      inserted++;
    }
  }

  console.log(`\n=== RÉSULTAT ===`);
  console.log(`  Mises à jour : ${updated}`);
  console.log(`  Insertions   : ${inserted}`);
  console.log(`  Total traité : ${rows.length}`);

  await pool.end();
})();
