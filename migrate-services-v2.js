require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:Number(process.env.DB_PORT)||5432});

/* ===================================================
   LISTE COMPLÈTE DES RÉPARATIONS — The SMARTPHONE
   Organisées par appareil et type de panne
   Modifiez les prix selon votre réalité terrain
   =================================================== */
const REPARATIONS=[
  // ── IPHONE — ÉCRAN ──────────────────────────────────────────────────────
  {s:1,  name:"Écran iPhone 16 Pro Max",    name_en:"iPhone 16 Pro Max screen",  name_ar:"شاشة آيفون 16 برو ماكس", price:199, market:250, delay:"1h"},
  {s:2,  name:"Écran iPhone 16 Pro",        name_en:"iPhone 16 Pro screen",       name_ar:"شاشة آيفون 16 برو",      price:189, market:230, delay:"1h"},
  {s:3,  name:"Écran iPhone 16 / 16 Plus",  name_en:"iPhone 16 / 16 Plus screen", name_ar:"شاشة آيفون 16",          price:179, market:220, delay:"1h"},
  {s:4,  name:"Écran iPhone 15 Pro Max",    name_en:"iPhone 15 Pro Max screen",  name_ar:"شاشة آيفون 15 برو ماكس", price:169, market:210, delay:"1h"},
  {s:5,  name:"Écran iPhone 15 / Pro",      name_en:"iPhone 15 / Pro screen",     name_ar:"شاشة آيفون 15",          price:149, market:190, delay:"1h"},
  {s:6,  name:"Écran iPhone 14 Pro Max",    name_en:"iPhone 14 Pro Max screen",  name_ar:"شاشة آيفون 14 برو ماكس", price:149, market:189, delay:"1h"},
  {s:7,  name:"Écran iPhone 14 / 14 Plus",  name_en:"iPhone 14 / 14 Plus screen", name_ar:"شاشة آيفون 14",          price:129, market:169, delay:"1h"},
  {s:8,  name:"Écran iPhone 13 Pro Max",    name_en:"iPhone 13 Pro Max screen",  name_ar:"شاشة آيفون 13 برو ماكس", price:129, market:165, delay:"1h"},
  {s:9,  name:"Écran iPhone 13 / Pro",      name_en:"iPhone 13 / Pro screen",     name_ar:"شاشة آيفون 13",          price:119, market:150, delay:"1h"},
  {s:10, name:"Écran iPhone 12 Pro Max",    name_en:"iPhone 12 Pro Max screen",  name_ar:"شاشة آيفون 12 برو ماكس", price:119, market:149, delay:"1h"},
  {s:11, name:"Écran iPhone 12 / Pro",      name_en:"iPhone 12 / Pro screen",     name_ar:"شاشة آيفون 12",          price:109, market:140, delay:"1h"},
  {s:12, name:"Écran iPhone 11 Pro Max",    name_en:"iPhone 11 Pro Max screen",  name_ar:"شاشة آيفون 11 برو ماكس", price:109, market:140, delay:"1h"},
  {s:13, name:"Écran iPhone 11",            name_en:"iPhone 11 screen",           name_ar:"شاشة آيفون 11",          price:89,  market:120, delay:"1h"},
  {s:14, name:"Écran iPhone XS Max / XR",   name_en:"iPhone XS Max / XR screen",  name_ar:"شاشة آيفون XS ماكس",    price:89,  market:120, delay:"1h"},
  {s:15, name:"Écran iPhone X / XS",        name_en:"iPhone X / XS screen",       name_ar:"شاشة آيفون X",           price:89,  market:115, delay:"1h"},
  {s:16, name:"Écran iPhone SE / 8 / 7",    name_en:"iPhone SE / 8 / 7 screen",   name_ar:"شاشة آيفون SE / 8",      price:69,  market:90,  delay:"45min"},

  // ── IPHONE — BATTERIE ────────────────────────────────────────────────────
  {s:20, name:"Batterie iPhone 16 Pro Max",  name_en:"iPhone 16 Pro Max battery",  name_ar:"بطارية آيفون 16 برو ماكس", price:89, market:110, delay:"30min"},
  {s:21, name:"Batterie iPhone 15 / 16",     name_en:"iPhone 15 / 16 battery",     name_ar:"بطارية آيفون 15/16",       price:79, market:99,  delay:"30min"},
  {s:22, name:"Batterie iPhone 12 / 13 / 14",name_en:"iPhone 12/13/14 battery",    name_ar:"بطارية آيفون 12/13/14",    price:59, market:80,  delay:"30min"},
  {s:23, name:"Batterie iPhone 11 / X / XR", name_en:"iPhone 11 / X / XR battery", name_ar:"بطارية آيفون 11/X",        price:49, market:70,  delay:"30min"},
  {s:24, name:"Batterie iPhone SE / 8 / 7",  name_en:"iPhone SE / 8 / 7 battery",  name_ar:"بطارية آيفون SE/8/7",      price:39, market:55,  delay:"30min"},

  // ── IPHONE — AUTRES PANNES ───────────────────────────────────────────────
  {s:30, name:"Connecteur charge iPhone (Lightning/USB-C)", name_en:"iPhone charging port", name_ar:"موصل شحن آيفون", price:59, market:80, delay:"1h"},
  {s:31, name:"Vitre arrière iPhone 12/13/14/15/16", name_en:"iPhone back glass",     name_ar:"زجاج خلفي آيفون",  price:69, market:99, delay:"2h"},
  {s:32, name:"Caméra arrière iPhone",         name_en:"iPhone rear camera",         name_ar:"كاميرا خلفية آيفون",  price:79, market:110, delay:"1h"},
  {s:33, name:"Haut-parleur / Micro iPhone",   name_en:"iPhone speaker / microphone", name_ar:"سماعة / مايك آيفون", price:49, market:70,  delay:"45min"},
  {s:34, name:"Bouton power / volume iPhone",  name_en:"iPhone power / volume button",name_ar:"زر تشغيل/صوت آيفون", price:49, market:69,  delay:"1h"},

  // ── SAMSUNG — ÉCRAN ──────────────────────────────────────────────────────
  {s:40, name:"Écran Samsung Galaxy S24 Ultra",  name_en:"Samsung S24 Ultra screen", name_ar:"شاشة سامسونج S24 أولترا", price:199, market:259, delay:"2h"},
  {s:41, name:"Écran Samsung Galaxy S24 / S23",  name_en:"Samsung S24 / S23 screen", name_ar:"شاشة سامسونج S24/S23",    price:149, market:199, delay:"2h"},
  {s:42, name:"Écran Samsung Galaxy S22 / S21",  name_en:"Samsung S22 / S21 screen", name_ar:"شاشة سامسونج S22/S21",    price:119, market:160, delay:"2h"},
  {s:43, name:"Écran Samsung Galaxy A55 / A54",  name_en:"Samsung A55 / A54 screen", name_ar:"شاشة سامسونج A55/A54",    price:89,  market:120, delay:"1h30"},
  {s:44, name:"Écran Samsung Galaxy A35 / A34",  name_en:"Samsung A35 / A34 screen", name_ar:"شاشة سامسونج A35/A34",    price:79,  market:105, delay:"1h30"},
  {s:45, name:"Écran Samsung Galaxy A25 / A15",  name_en:"Samsung A25 / A15 screen", name_ar:"شاشة سامسونج A25/A15",    price:69,  market:89,  delay:"1h"},
  {s:46, name:"Vitre seule Samsung (sans LCD)",  name_en:"Samsung glass only (no LCD)",name_ar:"زجاج سامسونج فقط",       price:49,  market:79,  delay:"2h"},

  // ── SAMSUNG — BATTERIE ────────────────────────────────────────────────────
  {s:50, name:"Batterie Samsung Galaxy S23 / S24",name_en:"Samsung S23/S24 battery",   name_ar:"بطارية سامسونج S24",   price:59, market:79, delay:"30min"},
  {s:51, name:"Batterie Samsung Galaxy A (série)", name_en:"Samsung Galaxy A battery",  name_ar:"بطارية سامسونج A",    price:49, market:69, delay:"30min"},

  // ── SAMSUNG — AUTRES ─────────────────────────────────────────────────────
  {s:55, name:"Connecteur charge Samsung USB-C",  name_en:"Samsung USB-C charging port",name_ar:"موصل شحن سامسونج", price:59, market:79, delay:"1h"},

  // ── XIAOMI / HUAWEI / AUTRES MARQUES ────────────────────────────────────
  {s:60, name:"Écran Xiaomi / Redmi",             name_en:"Xiaomi / Redmi screen",       name_ar:"شاشة شاومي",         price:79, market:110, delay:"1h30"},
  {s:61, name:"Écran Huawei P / Mate série",      name_en:"Huawei P / Mate screen",      name_ar:"شاشة هواوي",         price:89, market:120, delay:"1h30"},
  {s:62, name:"Batterie Xiaomi / Redmi / Huawei", name_en:"Xiaomi / Redmi / Huawei battery",name_ar:"بطارية شاومي/هواوي",price:49,market:69, delay:"30min"},

  // ── RÉPARATIONS UNIVERSELLES ─────────────────────────────────────────────
  {s:70, name:"Déverrouillage opérateur (SIM unlock)", name_en:"Network unlock (SIM)", name_ar:"فك قفل الشبكة",       price:29, market:49, delay:"30min"},
  {s:71, name:"Réinitialisation / Réinstallation iOS", name_en:"iOS reinstallation",   name_ar:"إعادة تثبيت iOS",      price:29, market:49, delay:"30min"},
  {s:72, name:"Réinitialisation / Réinstallation Android",name_en:"Android reinstallation",name_ar:"إعادة تثبيت أندرويد",price:29,market:49,delay:"30min"},
  {s:73, name:"Récupération de données",           name_en:"Data recovery",             name_ar:"استرجاع البيانات",     price:49, market:79, delay:"1h"},
  {s:74, name:"Dégât eau — diagnostic + nettoyage",name_en:"Water damage diagnosis",    name_ar:"تشخيص تلف الماء",      price:29, market:49, delay:"1h"},
  {s:75, name:"Diagnostic gratuit",                name_en:"Free diagnostic",            name_ar:"تشخيص مجاني",          price:0,  market:0,  delay:"15min"},

  // ── PC PORTABLE ───────────────────────────────────────────────────────────
  {s:80, name:"Écran PC portable (remplacement)",  name_en:"Laptop screen replacement", name_ar:"تغيير شاشة اللابتوب", price:119,market:160, delay:"2h"},
  {s:81, name:"Clavier PC portable (remplacement)",name_en:"Laptop keyboard replacement",name_ar:"تغيير لوحة مفاتيح اللابتوب",price:79,market:110,delay:"1h30"},
  {s:82, name:"Batterie PC portable",              name_en:"Laptop battery",             name_ar:"بطارية اللابتوب",      price:79, market:109, delay:"30min"},
  {s:83, name:"Connecteur alimentation PC",        name_en:"Laptop power connector",     name_ar:"موصل الطاقة للابتوب", price:69, market:99,  delay:"1h"},
  {s:84, name:"Réinstallation Windows 11",         name_en:"Windows 11 reinstallation",  name_ar:"إعادة تثبيت ويندوز 11",price:49,market:79, delay:"2h"},
  {s:85, name:"Nettoyage / ventilateur PC",        name_en:"PC cleaning / fan",           name_ar:"تنظيف اللابتوب",      price:39, market:59,  delay:"1h"},
  {s:86, name:"Upgrade SSD (+ fourniture SSD)",    name_en:"SSD upgrade (+ SSD supply)",  name_ar:"ترقية SSD",           price:79, market:120, delay:"1h"},
  {s:87, name:"Ajout mémoire RAM",                 name_en:"RAM upgrade",                 name_ar:"زيادة الذاكرة RAM",   price:39, market:59,  delay:"30min"},
];

const IMPRESSIONS=[
  {s:1, name:"Impression A4 N&B",    name_en:"A4 B&W print",        name_ar:"طباعة A4 أبيض وأسود",  price:0.10},
  {s:2, name:"Impression A4 couleur",name_en:"A4 color print",      name_ar:"طباعة A4 ملونة",        price:0.50},
  {s:3, name:"Photocopie A4",        name_en:"A4 photocopy",        name_ar:"تصوير A4",               price:0.10},
  {s:4, name:"Impression A3",        name_en:"A3 print",            name_ar:"طباعة A3",               price:1.00},
  {s:5, name:"Impression recto-verso A4",name_en:"A4 double-sided", name_ar:"طباعة وجهين A4",         price:0.15},
  {s:6, name:"Scan document",        name_en:"Document scan",       name_ar:"مسح وثيقة",              price:0.50},
  {s:7, name:"Impression photo 10x15",name_en:"Photo print 10x15",  name_ar:"طباعة صورة 10x15",       price:0.80},
  {s:8, name:"Impression format A2", name_en:"A2 format print",     name_ar:"طباعة A2",               price:3.00},
];

(async()=>{
  console.log('Suppression des anciens services de réparation...');
  await p.query(`DELETE FROM catalogue_services WHERE category='reparation'`);
  await p.query(`DELETE FROM catalogue_services WHERE category='impression'`);

  console.log('Insertion des réparations...');
  for(const r of REPARATIONS){
    await p.query(
      `INSERT INTO catalogue_services(category,name,name_en,name_ar,price,price_market,delay,visible,sort_order)
       VALUES('reparation',$1,$2,$3,$4,$5,$6,true,$7)`,
      [r.name, r.name_en||r.name, r.name_ar||r.name, r.price, r.market||null, r.delay||null, r.s]
    );
  }
  console.log('Réparations insérées : '+REPARATIONS.length);

  console.log('Insertion des impressions...');
  for(const i of IMPRESSIONS){
    await p.query(
      `INSERT INTO catalogue_services(category,name,name_en,name_ar,price,visible,sort_order)
       VALUES('impression',$1,$2,$3,$4,true,$5)`,
      [i.name, i.name_en||i.name, i.name_ar||i.name, i.price, i.s]
    );
  }
  console.log('Impressions insérées : '+IMPRESSIONS.length);
  console.log('\n=== MIGRATION SERVICES V2 DONE ===');
  await p.end();
})();
