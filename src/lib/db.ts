import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as { __moneyDb?: Database.Database };

export const SEED: [string, string, string, string][] = [
  // name, kind, emoji, color
  ["Transport", "expense", "🚌", "#3b82f6"],
  ["Shopping", "expense", "🛍️", "#ec4899"],
  ["Food & Dining", "expense", "🍔", "#f59e0b"],
  ["Bills & Utilities", "expense", "💡", "#eab308"],
  ["Rent / Housing", "expense", "🏠", "#8b5cf6"],
  ["Health", "expense", "💊", "#ef4444"],
  ["Entertainment", "expense", "🎬", "#06b6d4"],
  ["Education", "expense", "📚", "#14b8a6"],
  ["Giving (gifts, charity)", "expense", "🎁", "#f97316"],
  ["Family", "expense", "👪", "#a855f7"],
  ["Other", "expense", "📦", "#64748b"],
  ["Salary", "income", "💼", "#22c55e"],
  ["Business", "income", "🏪", "#16a34a"],
  ["Gift received", "income", "🎉", "#84cc16"],
  ["Other income", "income", "💰", "#10b981"],
  ["Loans & Debts", "loan", "🤝", "#6366f1"],
];

/** Give a user the default categories if they have none yet. */
export function ensureUserCategories(db: Database.Database, userId: number) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM categories WHERE user_id = ?").get(userId) as {
    n: number;
  };
  if (n > 0) return;
  const ins = db.prepare(
    "INSERT INTO categories (user_id, name, kind, emoji, color) VALUES (?,?,?,?,?)",
  );
  db.transaction(() => SEED.forEach((s) => ins.run(userId, ...s)))();
}

/**
 * Data created before accounts existed has user_id = 0. The first account that
 * signs up takes it over, so nothing recorded earlier is lost.
 */
export function claimLegacyData(db: Database.Database, userId: number) {
  db.transaction(() => {
    db.prepare("UPDATE categories SET user_id = ? WHERE user_id = 0").run(userId);
    db.prepare("UPDATE transactions SET user_id = ? WHERE user_id = 0").run(userId);
    db.prepare("UPDATE opening_balances SET user_id = ? WHERE user_id = 0").run(userId);
    const disp = db.prepare("SELECT value FROM settings WHERE key = 'display_currency'").get() as
      | { value: string }
      | undefined;
    if (disp)
      db.prepare(
        "INSERT OR IGNORE INTO user_settings (user_id, key, value) VALUES (?, 'display_currency', ?)",
      ).run(userId, disp.value);
  })();
}

function hasColumn(db: Database.Database, table: string, col: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === col);
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const hadOpening = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='opening_balances'")
    .get();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('income','expense','loan')),
      emoji TEXT NOT NULL DEFAULT '📦',
      color TEXT NOT NULL DEFAULT '#64748b',
      UNIQUE (user_id, name)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income','expense','lent','borrowed','repay_in','repay_out')),
      amount REAL NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      category_id INTEGER REFERENCES categories(id),
      person TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS budgets (
      month TEXT PRIMARY KEY,
      opening_balance REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD'
    );
    CREATE TABLE IF NOT EXISTS opening_balances (
      user_id INTEGER NOT NULL DEFAULT 0,
      month TEXT NOT NULL,
      currency TEXT NOT NULL CHECK (currency IN ('KES','USD')),
      amount REAL NOT NULL,
      PRIMARY KEY (user_id, month, currency)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ---- migrations for databases created by earlier versions ----
  if (!hasColumn(db, "transactions", "currency"))
    db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  if (!hasColumn(db, "budgets", "currency"))
    db.exec("ALTER TABLE budgets ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  if (!hasColumn(db, "transactions", "user_id"))
    db.exec("ALTER TABLE transactions ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0");

  if (!hasColumn(db, "categories", "user_id")) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      BEGIN;
      CREATE TABLE categories_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 0,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense','loan')),
        emoji TEXT NOT NULL DEFAULT '📦',
        color TEXT NOT NULL DEFAULT '#64748b',
        UNIQUE (user_id, name)
      );
      INSERT INTO categories_new (id, name, kind, emoji, color)
        SELECT id, name, kind, emoji, color FROM categories;
      DROP TABLE categories;
      ALTER TABLE categories_new RENAME TO categories;
      COMMIT;
    `);
    db.pragma("foreign_keys = ON");
  }

  if (!hasColumn(db, "opening_balances", "user_id")) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      BEGIN;
      CREATE TABLE opening_balances_new (
        user_id INTEGER NOT NULL DEFAULT 0,
        month TEXT NOT NULL,
        currency TEXT NOT NULL CHECK (currency IN ('KES','USD')),
        amount REAL NOT NULL,
        PRIMARY KEY (user_id, month, currency)
      );
      INSERT INTO opening_balances_new (month, currency, amount)
        SELECT month, currency, amount FROM opening_balances;
      DROP TABLE opening_balances;
      ALTER TABLE opening_balances_new RENAME TO opening_balances;
      COMMIT;
    `);
    db.pragma("foreign_keys = ON");
  }

  if (!hadOpening)
    db.exec(
      "INSERT OR IGNORE INTO opening_balances (month, currency, amount) SELECT month, currency, opening_balance FROM budgets",
    );

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
    INSERT OR IGNORE INTO settings (key, value) VALUES ('display_currency', 'KES');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('usd_to_kes', '129');
    DELETE FROM sessions WHERE expires_at < strftime('%s','now') * 1000;
  `);
}

export function getDb(): Database.Database {
  if (!globalForDb.__moneyDb) {
    const dir = process.env.MONEY_DB_DIR ?? path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "money.db"));
    init(db);
    globalForDb.__moneyDb = db;
  }
  return globalForDb.__moneyDb;
}
