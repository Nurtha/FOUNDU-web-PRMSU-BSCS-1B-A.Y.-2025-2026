const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');

const localDbPath = process.env.LOCAL_DB_PATH || path.join(__dirname, '..', 'foundu.db');
const remoteDbUrl = (process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL || '').trim();
const remoteDbAuthToken = (process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || '').trim();

if (!remoteDbUrl) {
  console.error('Set LIBSQL_URL or TURSO_DATABASE_URL before running the migration.');
  process.exit(1);
}

const remoteClient = createClient({
  url: remoteDbUrl,
  authToken: remoteDbAuthToken || undefined
});

function openLocalDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(localDbPath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(db);
    });
  });
}

function localAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

async function ensureRemoteSchema() {
  await remoteClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'pending',
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      cat TEXT NOT NULL,
      loc TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      contact TEXT NOT NULL,
      photo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    args: []
  });

  await remoteClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS claim_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      claimant_name TEXT NOT NULL DEFAULT '',
      claimant_student_id TEXT NOT NULL DEFAULT '',
      proof_image TEXT,
      claim_message TEXT,
      admin_note TEXT,
      reviewed_at TEXT,
      item_type TEXT,
      item_cat TEXT,
      item_title TEXT,
      item_loc TEXT,
      item_date TEXT,
      cert_name TEXT,
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      issued_at TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
    args: []
  });

  await remoteClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS good_samaritan_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      finder_name TEXT NOT NULL,
      total_returns INTEGER NOT NULL DEFAULT 1,
      last_return_date TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    args: []
  });

  await remoteClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS item_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair_key TEXT,
      source_item_id INTEGER NOT NULL,
      target_item_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      score REAL NOT NULL,
      keyword_score REAL NOT NULL DEFAULT 0,
      location_score REAL NOT NULL DEFAULT 0,
      date_score REAL NOT NULL DEFAULT 0,
      matched_keywords TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      action_note TEXT,
      requested_at TEXT,
      reviewed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_item_id) REFERENCES items(id),
      FOREIGN KEY (target_item_id) REFERENCES items(id)
    )`,
    args: []
  });

  await remoteClient.execute({
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_item_matches_pair_key ON item_matches(pair_key)',
    args: []
  });
}

async function replaceTable(tableName, rows, insertSql, mapper) {
  await remoteClient.execute({ sql: `DELETE FROM ${tableName}`, args: [] });

  for (const row of rows) {
    const values = mapper(row);
    await remoteClient.execute({ sql: insertSql, args: values });
  }
}

async function run() {
  const localDb = await openLocalDatabase();

  try {
    await ensureRemoteSchema();

    const items = await localAll(localDb, 'SELECT id, status, type, title, cat, loc, date, description, contact, photo, created_at FROM items ORDER BY id ASC');
    await replaceTable(
      'items',
      items,
      'INSERT INTO items (id, status, type, title, cat, loc, date, description, contact, photo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      (row) => [row.id, row.status, row.type, row.title, row.cat, row.loc, row.date, row.description, row.contact, row.photo || '', row.created_at || null]
    );

    const claims = await localAll(localDb, 'SELECT id, item_id, status, claimant_name, claimant_student_id, proof_image, claim_message, admin_note, reviewed_at, item_type, item_cat, item_title, item_loc, item_date, cert_name, requested_at, issued_at FROM claim_requests ORDER BY id ASC');
    await replaceTable(
      'claim_requests',
      claims,
      'INSERT INTO claim_requests (id, item_id, status, claimant_name, claimant_student_id, proof_image, claim_message, admin_note, reviewed_at, item_type, item_cat, item_title, item_loc, item_date, cert_name, requested_at, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      (row) => [
        row.id,
        row.item_id,
        row.status,
        row.claimant_name || '',
        row.claimant_student_id || '',
        row.proof_image || null,
        row.claim_message || null,
        row.admin_note || null,
        row.reviewed_at || null,
        row.item_type || null,
        row.item_cat || null,
        row.item_title || null,
        row.item_loc || null,
        row.item_date || null,
        row.cert_name || null,
        row.requested_at || null,
        row.issued_at || null
      ]
    );

    const samaritans = await localAll(localDb, 'SELECT id, finder_name, total_returns, last_return_date, note, created_at, updated_at FROM good_samaritan_entries ORDER BY id ASC');
    await replaceTable(
      'good_samaritan_entries',
      samaritans,
      'INSERT INTO good_samaritan_entries (id, finder_name, total_returns, last_return_date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      (row) => [row.id, row.finder_name, row.total_returns, row.last_return_date || null, row.note || null, row.created_at || null, row.updated_at || null]
    );

    const matches = await localAll(localDb, 'SELECT id, pair_key, source_item_id, target_item_id, source_type, target_type, score, keyword_score, location_score, date_score, matched_keywords, status, action_note, requested_at, reviewed_at, created_at FROM item_matches ORDER BY id ASC');
    await replaceTable(
      'item_matches',
      matches,
      'INSERT INTO item_matches (id, pair_key, source_item_id, target_item_id, source_type, target_type, score, keyword_score, location_score, date_score, matched_keywords, status, action_note, requested_at, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      (row) => [
        row.id,
        row.pair_key || null,
        row.source_item_id,
        row.target_item_id,
        row.source_type,
        row.target_type,
        row.score,
        row.keyword_score,
        row.location_score,
        row.date_score,
        row.matched_keywords || null,
        row.status,
        row.action_note || null,
        row.requested_at || null,
        row.reviewed_at || null,
        row.created_at || null
      ]
    );

    console.log(`Migrated ${items.length} items, ${claims.length} claims, ${samaritans.length} good samaritans, and ${matches.length} matches to the remote database.`);
  } finally {
    localDb.close();
    if (typeof remoteClient.close === 'function') {
      await remoteClient.close();
    }
  }
}

run().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exit(1);
});