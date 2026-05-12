-- ============================================================
--  THE SMARTPHONE — Tables principales
-- ============================================================

-- Products
CREATE TABLE IF NOT EXISTS products (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  category         VARCHAR(50)  DEFAULT 'Autre',
  condition        VARCHAR(20)  DEFAULT 'NEUF',
  color            VARCHAR(30),
  grade            VARCHAR(20),
  location_zone    VARCHAR(50),
  location_detail  VARCHAR(50),
  stock_alert      INT          DEFAULT 3,
  sale_price       NUMERIC(10,2) DEFAULT 0,
  purchase_price   NUMERIC(10,2) DEFAULT 0,
  stock_quantity   INT          DEFAULT 0,
  barcode          VARCHAR(50),
  supplier_id      INT,
  supplier_name    VARCHAR(100),
  created_at       TIMESTAMP    DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  total          NUMERIC(10,2) DEFAULT 0,
  payment_method VARCHAR(20)   DEFAULT 'cash',
  customer_name  VARCHAR(100),
  comment        TEXT,
  status         VARCHAR(20)   DEFAULT 'completed',
  amount_cb      NUMERIC(10,2) DEFAULT 0,
  amount_cash    NUMERIC(10,2) DEFAULT 0,
  amount_credit  NUMERIC(10,2) DEFAULT 0,
  created_at     TIMESTAMP     DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  quantity   INT           DEFAULT 1,
  price      NUMERIC(10,2) DEFAULT 0,
  discount   NUMERIC(10,2) DEFAULT 0
);

-- Repairs
CREATE TABLE IF NOT EXISTS repairs (
  id               SERIAL PRIMARY KEY,
  customer_name    VARCHAR(100),
  phone            VARCHAR(30),
  device_type      VARCHAR(50),
  brand            VARCHAR(50),
  model            VARCHAR(100),
  serial_number    VARCHAR(100),
  issue            TEXT,
  estimated_price  NUMERIC(10,2) DEFAULT 0,
  final_price      NUMERIC(10,2),
  status           VARCHAR(30)   DEFAULT 'EN_ATTENTE',
  payment_method   VARCHAR(20)   DEFAULT 'cash',
  amount_cb        NUMERIC(10,2) DEFAULT 0,
  amount_cash      NUMERIC(10,2) DEFAULT 0,
  amount_credit    NUMERIC(10,2) DEFAULT 0,
  comment          TEXT,
  created_at       TIMESTAMP     DEFAULT NOW(),
  updated_at       TIMESTAMP     DEFAULT NOW(),
  delivered_at     TIMESTAMP
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  description VARCHAR(200),
  amount      NUMERIC(10,2) DEFAULT 0,
  category    VARCHAR(50)   DEFAULT 'Autre',
  date        DATE          DEFAULT CURRENT_DATE,
  created_at  TIMESTAMP     DEFAULT NOW()
);

-- Customer credits
CREATE TABLE IF NOT EXISTS customer_credits (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(100),
  phone         VARCHAR(30),
  order_id      INT REFERENCES orders(id) ON DELETE SET NULL,
  repair_id     INT REFERENCES repairs(id) ON DELETE SET NULL,
  total_amount  NUMERIC(10,2) DEFAULT 0,
  amount_paid   NUMERIC(10,2) DEFAULT 0,
  amount_due    NUMERIC(10,2) DEFAULT 0,
  status        VARCHAR(20)   DEFAULT 'EN_COURS',
  notes         TEXT,
  created_at    TIMESTAMP     DEFAULT NOW(),
  updated_at    TIMESTAMP     DEFAULT NOW()
);

-- Credit payments
CREATE TABLE IF NOT EXISTS credit_payments (
  id             SERIAL PRIMARY KEY,
  credit_id      INT REFERENCES customer_credits(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) DEFAULT 0,
  payment_method VARCHAR(20)   DEFAULT 'cash',
  notes          TEXT,
  created_at     TIMESTAMP     DEFAULT NOW()
);

-- Returns store
CREATE TABLE IF NOT EXISTS returns_store (
  id             SERIAL PRIMARY KEY,
  order_id       INT REFERENCES orders(id) ON DELETE SET NULL,
  customer_name  VARCHAR(100),
  phone          VARCHAR(30),
  reason         TEXT,
  refund_method  VARCHAR(20)   DEFAULT 'cash',
  refund_amount  NUMERIC(10,2) DEFAULT 0,
  items          JSONB,
  notes          TEXT,
  status         VARCHAR(20)   DEFAULT 'EN_ATTENTE',
  created_at     TIMESTAMP     DEFAULT NOW(),
  updated_at     TIMESTAMP     DEFAULT NOW()
);

-- Returns supplier
CREATE TABLE IF NOT EXISTS returns_supplier (
  id              SERIAL PRIMARY KEY,
  supplier_name   VARCHAR(100),
  product_name    VARCHAR(200),
  quantity        INT           DEFAULT 1,
  reason          TEXT,
  refund_amount   NUMERIC(10,2) DEFAULT 0,
  tracking_number VARCHAR(100),
  notes           TEXT,
  status          VARCHAR(20)   DEFAULT 'EN_ATTENTE',
  created_at      TIMESTAMP     DEFAULT NOW(),
  updated_at      TIMESTAMP     DEFAULT NOW()
);

-- Stock damaged
CREATE TABLE IF NOT EXISTS stock_damaged (
  id           SERIAL PRIMARY KEY,
  product_id   INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200),
  quantity     INT           DEFAULT 1,
  reason       TEXT,
  responsible  VARCHAR(100),
  cost_value   NUMERIC(10,2) DEFAULT 0,
  created_at   TIMESTAMP     DEFAULT NOW()
);

-- Print queue
CREATE TABLE IF NOT EXISTS print_queue (
  id          SERIAL PRIMARY KEY,
  filename    VARCHAR(200),
  filepath    VARCHAR(300),
  filetype    VARCHAR(20),
  filesize    INT,
  copies      INT         DEFAULT 1,
  color_mode  VARCHAR(10) DEFAULT 'bw',
  status      VARCHAR(20) DEFAULT 'EN_ATTENTE',
  uploaded_at TIMESTAMP   DEFAULT NOW(),
  printed_at  TIMESTAMP
);

-- Lots
CREATE TABLE IF NOT EXISTS lots (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  supplier_name  VARCHAR(100),
  supplier_phone VARCHAR(30),
  purchase_date  DATE         DEFAULT CURRENT_DATE,
  total_cost     NUMERIC(10,2) DEFAULT 0,
  amount_cb      NUMERIC(10,2) DEFAULT 0,
  amount_cash    NUMERIC(10,2) DEFAULT 0,
  amount_credit  NUMERIC(10,2) DEFAULT 0,
  expense_id     INT REFERENCES expenses(id) ON DELETE SET NULL,
  status         VARCHAR(20)  DEFAULT 'EN_COURS',
  notes          TEXT,
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- Lot items
CREATE TABLE IF NOT EXISTS lot_items (
  id             SERIAL PRIMARY KEY,
  lot_id         INT REFERENCES lots(id) ON DELETE CASCADE,
  product_id     INT REFERENCES products(id) ON DELETE SET NULL,
  name           VARCHAR(200),
  purchase_price NUMERIC(10,2) DEFAULT 0,
  sale_price     NUMERIC(10,2),
  status         VARCHAR(20)  DEFAULT 'EN_TEST',
  order_id       INT REFERENCES orders(id) ON DELETE SET NULL,
  repair_id      INT REFERENCES repairs(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMP    DEFAULT NOW(),
  updated_at     TIMESTAMP    DEFAULT NOW()
);

-- Lot costs
CREATE TABLE IF NOT EXISTS lot_costs (
  id           SERIAL PRIMARY KEY,
  lot_id       INT REFERENCES lots(id) ON DELETE CASCADE,
  lot_item_id  INT REFERENCES lot_items(id) ON DELETE SET NULL,
  description  VARCHAR(200),
  amount       NUMERIC(10,2) DEFAULT 0,
  cost_type    VARCHAR(30)   DEFAULT 'piece',
  repair_type  VARCHAR(20)   DEFAULT 'interne',
  product_id   INT REFERENCES products(id) ON DELETE SET NULL,
  quantity     INT           DEFAULT 1,
  created_at   TIMESTAMP     DEFAULT NOW()
);

-- Vérification
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
