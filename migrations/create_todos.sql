CREATE TABLE IF NOT EXISTS todos (
  id          SERIAL PRIMARY KEY,
  text        VARCHAR(300) NOT NULL,
  priority    VARCHAR(5) DEFAULT 'P1',
  done        BOOLEAN DEFAULT FALSE,
  created_by  VARCHAR(100) DEFAULT '',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
SELECT 'todos créé ✅' AS status;
