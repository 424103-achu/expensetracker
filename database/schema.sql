CREATE TABLE IF NOT EXISTS users (
  uid SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  currency_preference VARCHAR(10) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);

INSERT INTO categories (name)
VALUES
  ('Food and Dining'),
  ('Transport'),
  ('Shopping'),
  ('Entertainment'),
  ('Health and Medical'),
  ('Education'),
  ('Utilities'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS shared_expenses (
  shared_expense_id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL CHECK (total_cost > 0),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  expense_date DATE NOT NULL,
  payment_mode VARCHAR(40) NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  expense_id SERIAL PRIMARY KEY,
  uid INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  owner_share NUMERIC(12,2) NOT NULL CHECK (owner_share >= 0),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  shared_expense_id INTEGER REFERENCES shared_expenses(shared_expense_id) ON DELETE SET NULL,
  expense_date DATE NOT NULL,
  payment_mode VARCHAR(40) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_participants (
  participant_id SERIAL PRIMARY KEY,
  shared_expense_id INTEGER NOT NULL REFERENCES shared_expenses(shared_expense_id) ON DELETE CASCADE,
  uid INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  assigned_cost NUMERIC(12,2) NOT NULL CHECK (assigned_cost >= 0),
  pending_amount NUMERIC(12,2) NOT NULL CHECK (pending_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(shared_expense_id, uid)
);

CREATE TABLE IF NOT EXISTS repayment_transactions (
  transaction_id SERIAL PRIMARY KEY,
  shared_expense_id INTEGER NOT NULL REFERENCES shared_expenses(shared_expense_id) ON DELETE CASCADE,
  from_uid INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  to_uid INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode VARCHAR(40) NOT NULL,
  notes TEXT,
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'repay',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_budgets (
  budget_id SERIAL PRIMARY KEY,
  uid INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  month_key CHAR(7) NOT NULL,
  threshold NUMERIC(12,2) NOT NULL CHECK (threshold > 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(uid, category_id, month_key)
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  uid INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_uid_date ON expenses(uid, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_shared_owner ON shared_expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_participants_uid ON shared_participants(uid);
CREATE INDEX IF NOT EXISTS idx_budgets_uid_month ON monthly_budgets(uid, month_key);
