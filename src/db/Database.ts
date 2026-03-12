/**
 * SQLite database for Pixel Chat (sql.js / WebAssembly).
 *
 * Persists the binary DB into IndexedDB so it survives page reloads.
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

const IDB_NAME = 'pixel-chat-db';
const IDB_STORE = 'sqliteStore';
const IDB_KEY = 'main';

export interface AgentRow {
  id: string;
  name: string;
  skill_id: string;
  body_color: string;
  hair_color: string;
  home_x: number;
  home_y: number;
  zone: string;
  brain_names: string; // JSON array
  avatar_seed: string | null;
  created_at: string;
  updated_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  skill_id    TEXT NOT NULL,
  body_color  TEXT NOT NULL,
  hair_color  TEXT NOT NULL,
  home_x      INTEGER NOT NULL,
  home_y      INTEGER NOT NULL,
  zone        TEXT NOT NULL,
  brain_names TEXT NOT NULL DEFAULT '[]',
  avatar_seed TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
`;

// ── IndexedDB helpers ────────────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(data, IDB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Database class ───────────────────────────────────────────────

class Database {
  private db: SqlJsDatabase | null = null;
  private ready: Promise<void>;
  private resolveReady!: () => void;
  private _initError: string | null = null;

  get isOpen(): boolean { return this.db !== null; }
  get initError(): string | null { return this._initError; }

  constructor() {
    this.ready = new Promise(r => { this.resolveReady = r; });
  }

  async init(): Promise<void> {
    try {
      console.log('[DB] Loading sql.js WASM...');
      const SQL = await initSqlJs({
        locateFile: () => `${window.location.origin}/sql-wasm.wasm`,
      });
      console.log('[DB] WASM loaded, opening database...');

      let persisted: Uint8Array | null = null;
      try {
        persisted = await loadFromIDB();
        if (persisted) console.log('[DB] Restored from IndexedDB:', persisted.byteLength, 'bytes');
      } catch (idbErr) {
        console.warn('[DB] IndexedDB load failed, starting fresh:', idbErr);
      }

      this.db = persisted ? new SQL.Database(persisted) : new SQL.Database();
      this.db.run(SCHEMA);
      await this.persist();

      console.log('[DB] SQLite ready');
    } catch (err) {
      this._initError = err instanceof Error ? err.message : String(err);
      console.error('[DB] INIT FAILED:', this._initError);
    } finally {
      this.resolveReady();
    }
  }

  async waitReady(): Promise<void> {
    return this.ready;
  }

  // ── Persist ──────────────────────────────────────────────────

  async persist(): Promise<void> {
    if (!this.db) return;
    try {
      const data = this.db.export();
      await saveToIDB(data);
    } catch (err) {
      console.error('[DB] Persist failed:', err);
    }
  }

  // ── Agent CRUD ───────────────────────────────────────────────

  getAllAgents(): AgentRow[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY created_at');
    const rows: AgentRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as AgentRow);
    }
    stmt.free();
    return rows;
  }

  getAgent(id: string): AgentRow | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? (stmt.getAsObject() as unknown as AgentRow) : null;
    stmt.free();
    return row;
  }

  async upsertAgent(agent: Omit<AgentRow, 'created_at' | 'updated_at'>): Promise<void> {
    if (!this.db) {
      console.error('[DB] Cannot upsert — database not initialized');
      return;
    }
    this.db.run(
      `INSERT INTO agents (id, name, skill_id, body_color, hair_color, home_x, home_y, zone, brain_names, avatar_seed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         skill_id = excluded.skill_id,
         body_color = excluded.body_color,
         hair_color = excluded.hair_color,
         home_x = excluded.home_x,
         home_y = excluded.home_y,
         zone = excluded.zone,
         brain_names = excluded.brain_names,
         avatar_seed = excluded.avatar_seed,
         updated_at = datetime('now')`,
      [
        agent.id, agent.name, agent.skill_id,
        agent.body_color, agent.hair_color,
        agent.home_x, agent.home_y, agent.zone,
        agent.brain_names, agent.avatar_seed ?? null,
      ],
    );
    await this.persist();
  }

  async deleteAgent(id: string): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM agents WHERE id = ?', [id]);
    await this.persist();
  }

  async deleteAllAgents(): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM agents');
    await this.persist();
  }

  agentCount(): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM agents');
    stmt.step();
    const count = (stmt.getAsObject() as { cnt: number }).cnt;
    stmt.free();
    return count;
  }

  // ── Export / Import ──────────────────────────────────────────

  exportJSON(): string {
    return JSON.stringify(this.getAllAgents(), null, 2);
  }

  async importJSON(json: string): Promise<number> {
    const agents: AgentRow[] = JSON.parse(json);
    for (const a of agents) {
      await this.upsertAgent(a);
    }
    return agents.length;
  }
}

export const db = new Database();
