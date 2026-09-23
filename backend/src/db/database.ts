import Database from 'better-sqlite3'
import pg from 'pg'
import path from 'path'
import fs from 'fs'

// Storage backend:
// - DATABASE_URL set (e.g. Neon Postgres) -> Postgres, data survives restarts and redeploys
// - unset -> local SQLite file at backend/data/omniops.sqlite (dev / zero-config demo)
// All queries use `?` placeholders; they are rewritten to $1, $2, ... for Postgres.

type Row = Record<string, any>

interface Driver {
  kind: 'postgres' | 'sqlite'
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>
  init(): Promise<void>
  describe(): string
}

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'operator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ANALYZING', 'AWAITING_APPROVAL', 'RESOLVED', 'FAILED')),
    resolution TEXT,
    user_id TEXT,
    source TEXT,
    external_ref TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    thought TEXT,
    action TEXT NOT NULL,
    data_payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(incident_id) REFERENCES incidents(id) ON DELETE CASCADE
  );
`

const POSTGRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'operator',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ANALYZING', 'AWAITING_APPROVAL', 'RESOLVED', 'FAILED')),
    resolution TEXT,
    user_id TEXT REFERENCES users(id),
    source TEXT,
    external_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    thought TEXT,
    action TEXT NOT NULL,
    data_payload TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_agent_logs_incident ON agent_logs(incident_id, step_number);
  CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source TEXT;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS external_ref TEXT;
  CREATE INDEX IF NOT EXISTS idx_incidents_external_ref ON incidents(external_ref);
`

// Rewrite `?` placeholders to $1..$n, skipping anything inside single-quoted SQL strings
function toPgPlaceholders(sql: string): string {
  let out = ''
  let n = 0
  let inString = false
  for (const ch of sql) {
    if (ch === "'") inString = !inString
    if (ch === '?' && !inString) {
      n += 1
      out += `$${n}`
    } else {
      out += ch
    }
  }
  return out
}

function createPostgresDriver(connectionString: string): Driver {
  // COUNT(*) comes back as bigint; return it as a JS number
  pg.types.setTypeParser(20, (v) => Number(v))

  const localHost = /@(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString)
  const pool = new pg.Pool({
    connectionString,
    // Neon and most hosted Postgres require TLS; local dev databases usually don't have it
    ssl: localHost || process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
  })
  pool.on('error', (err) => console.error('[Database] Postgres pool error:', err.message))

  return {
    kind: 'postgres',
    async get(sql, params = []) {
      const r = await pool.query(toPgPlaceholders(sql), params)
      return r.rows[0]
    },
    async all(sql, params = []) {
      const r = await pool.query(toPgPlaceholders(sql), params)
      return r.rows
    },
    async run(sql, params = []) {
      const r = await pool.query(toPgPlaceholders(sql), params)
      return { changes: r.rowCount ?? 0 }
    },
    async init() {
      await pool.query(POSTGRES_SCHEMA)
    },
    describe() {
      try {
        return `Postgres at ${new URL(connectionString).hostname}`
      } catch {
        return 'Postgres'
      }
    },
  }
}

function createSqliteDriver(): Driver {
  const dataDir = path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const dbPath = path.join(dataDir, 'omniops.sqlite')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')

  return {
    kind: 'sqlite',
    async get(sql, params = []) {
      return sqlite.prepare(sql).get(...params) as any
    },
    async all(sql, params = []) {
      return sqlite.prepare(sql).all(...params) as any
    },
    async run(sql, params = []) {
      const r = sqlite.prepare(sql).run(...params)
      return { changes: r.changes }
    },
    async init() {
      sqlite.exec(SQLITE_SCHEMA)
      // Upgrade databases created before alert intake added these columns
      const cols = (sqlite.prepare('PRAGMA table_info(incidents)').all() as Array<{ name: string }>).map((c) => c.name)
      if (!cols.includes('source')) sqlite.exec('ALTER TABLE incidents ADD COLUMN source TEXT')
      if (!cols.includes('external_ref')) sqlite.exec('ALTER TABLE incidents ADD COLUMN external_ref TEXT')
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_incidents_external_ref ON incidents(external_ref)')
    },
    describe() {
      return `SQLite at ${dbPath}`
    },
  }
}

export const db: Driver = process.env.DATABASE_URL
  ? createPostgresDriver(process.env.DATABASE_URL)
  : createSqliteDriver()

export async function initDatabase(): Promise<void> {
  await db.init()
  console.log(`[Database] ${db.describe()} ready`)
}
