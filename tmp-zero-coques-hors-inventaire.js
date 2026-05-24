require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432
});

// Les 55 coques de l'inventaire (noms exacts)
const INVENTAIRE = [
  'Coque iPhone 17 Pro',
  'Coque iPhone 17',
  'Coque iPhone 17 Pro Max',
  'Coque iPhone 17R',
  'Coque iPhone 16 Plus',
  'Coque iPhone 16 Pro',
  'Coque iPhone 16 Pro Max',
  'Coque iPhone 16',
  'Coque iPhone 15 Plus',
  'Coque iPhone 15 Pro',
  'Coque iPhone 15 Pro Max',
  'Coque iPhone 15',
  'Coque iPhone 14 Pro Max',
  'Coque iPhone 14 Pro',
  'Coque iPhone 14 Plus',
  'Coque iPhone 14',
  'Coque iPhone 13 Pro Max',
  'Coque iPhone 13 Pro',
  'Coque iPhone 13',
  'Coque iPhone 12 Pro Max',
  'Coque iPhone 12 Pro',
  'Coque iPhone 12',
  'Coque iPhone 11 Pro Max',
  'Coque iPhone 11 Pro',
  'Coque iPhone 11',
  'Coque iPhone 12 Mini',
  'Coque iPhone 13 Mini',
  'Coque iPhone XR',
  'Coque iPhone 8',
  'Coque iPhone XS Max',
  'Coque iPhone XS',
  'Coque iPhone 6 Plus',
  'Coque iPhone 7 Plus / 8 Plus',
  'Coque avec pochette IPhone XR',
  'Coque avec pochette IPhone 12 Pro Max',
  'Coque avec pochette IPhone 11',
  'Coque avec pochette IPhone 11 Pro',
  'Coque avec pochette IPhone 15',
  'Coque avec pochette IPhone 15 Pro',
  'Coque avec pochette IPhone 15 Plus',
  'Coque avec pochette IPhone 16',
  'Coque avec pochette IPhone 16 Pro Max',
  'Coque avec pochette IPhone 16 Plus',
  'Coque Samsung Galaxy S20',
  'Coque Samsung Galaxy S20 FE',
  'Coque Samsung Galaxy S21 Plus',
  'Coque Samsung Galaxy S21 Ultra',
  'Coque Samsung Galaxy S21 FE',
  'Coque Samsung Galaxy S22',
  'Coque Samsung Galaxy S22 Plus',
  'Coque Samsung Galaxy S22 Ultra',
  'Coque Samsung Galaxy S23 SE',
  'Coque Samsung Galaxy S23 Plus',
  'Coque Samsung Galaxy S23',
  'Coque Samsung Galaxy S23 Ultra',
];

(async () => {
  // Récupérer toutes les coques en base
  const all = await pool.query(
    `SELECT id, name, stock_quantity FROM products WHERE category='Coque' ORDER BY name`
  );

  console.log(`Coques en base : ${all.rows.length}`);
  console.log(`Coques dans l'inventaire : ${INVENTAIRE.length}\n`);

  const aZero = [];

  for (const prod of all.rows) {
    // Vérifier si ce produit est dans l'inventaire (comparaison insensible à la casse)
    const dansInventaire = INVENTAIRE.some(
      inv => inv.toLowerCase() === prod.name.toLowerCase()
    );

    if (!dansInventaire) {
      aZero.push(prod);
    }
  }

  if (aZero.length === 0) {
    console.log('✅ Aucune coque hors inventaire trouvée. Rien à faire.');
    await pool.end();
    return;
  }

  console.log(`${aZero.length} coque(s) hors inventaire → stock mis à 0 :\n`);

  for (const prod of aZero) {
    await pool.query(
      `UPDATE products SET stock_quantity=0, updated_at=NOW() WHERE id=$1`,
      [prod.id]
    );
    console.log(`  🔲 [id=${prod.id}] "${prod.name}" : ${prod.stock_quantity} → 0`);
  }

  console.log(`\n✅ ${aZero.length} produit(s) mis à 0.`);
  await pool.end();
})();
