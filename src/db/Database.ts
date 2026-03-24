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

export interface ToolMappingRow {
  id: number;
  agent_id: string;
  tool_name: string;
  label: string;
  tile_type: string | null;
  target_x: number | null;
  target_y: number | null;
}

export interface MapDataRow {
  id: number;
  grid: string;   // JSON number[][]
  cols: number;
  rows: number;
  updated_at: string;
}

export interface ZoneRow {
  id: string;
  label: string;
  bounds_x: number;
  bounds_y: number;
  bounds_w: number;
  bounds_h: number;
  poi_x: number;
  poi_y: number;
}

export interface TileDefRow {
  id: number;
  name: string;
  char_code: string;
  walkable: number;      // 0 | 1
  interactable: number;  // 0 | 1
  sprite_data: string | null;
  created_at: string;
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

CREATE TABLE IF NOT EXISTS tool_mappings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL,
  tool_name   TEXT NOT NULL,
  label       TEXT NOT NULL,
  tile_type   TEXT,
  target_x    INTEGER,
  target_y    INTEGER,
  UNIQUE(agent_id, tool_name)
);

CREATE TABLE IF NOT EXISTS map_data (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  grid        TEXT NOT NULL,
  cols        INTEGER NOT NULL DEFAULT 32,
  rows        INTEGER NOT NULL DEFAULT 24,
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zones (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  bounds_x    INTEGER NOT NULL,
  bounds_y    INTEGER NOT NULL,
  bounds_w    INTEGER NOT NULL,
  bounds_h    INTEGER NOT NULL,
  poi_x       INTEGER NOT NULL,
  poi_y       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tile_defs (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  char_code     TEXT NOT NULL DEFAULT '?',
  walkable      INTEGER NOT NULL DEFAULT 0,
  interactable  INTEGER NOT NULL DEFAULT 0,
  sprite_data   TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
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
      for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
        this.db.run(stmt);
      }
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

  // ── Tool Mappings CRUD ─────────────────────────────────────

  getToolMappingsForAgent(agentId: string): ToolMappingRow[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM tool_mappings WHERE agent_id = ? ORDER BY tool_name',
    );
    stmt.bind([agentId]);
    const rows: ToolMappingRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as ToolMappingRow);
    }
    stmt.free();
    return rows;
  }

  getAllToolMappings(): ToolMappingRow[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM tool_mappings ORDER BY agent_id, tool_name');
    const rows: ToolMappingRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as ToolMappingRow);
    }
    stmt.free();
    return rows;
  }

  async upsertToolMapping(mapping: Omit<ToolMappingRow, 'id'>): Promise<void> {
    if (!this.db) {
      console.error('[DB] Cannot upsert tool mapping — database not initialized');
      return;
    }
    this.db.run(
      `INSERT INTO tool_mappings (agent_id, tool_name, label, tile_type, target_x, target_y)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent_id, tool_name) DO UPDATE SET
         label = excluded.label,
         tile_type = excluded.tile_type,
         target_x = excluded.target_x,
         target_y = excluded.target_y`,
      [
        mapping.agent_id, mapping.tool_name, mapping.label,
        mapping.tile_type ?? null, mapping.target_x ?? null, mapping.target_y ?? null,
      ],
    );
    await this.persist();
  }

  async deleteToolMapping(agentId: string, toolName: string): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM tool_mappings WHERE agent_id = ? AND tool_name = ?', [agentId, toolName]);
    await this.persist();
  }

  async deleteToolMappingsForAgent(agentId: string): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM tool_mappings WHERE agent_id = ?', [agentId]);
    await this.persist();
  }

  // ── Map Data CRUD ───────────────────────────────────────────

  getMapGrid(): number[][] | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT grid FROM map_data WHERE id = 1');
    if (!stmt.step()) { stmt.free(); return null; }
    const row = stmt.getAsObject() as { grid: string };
    stmt.free();
    try { return JSON.parse(row.grid) as number[][]; }
    catch { return null; }
  }

  async saveMapGrid(grid: number[][], cols: number, rows: number): Promise<void> {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO map_data (id, grid, cols, rows, updated_at)
       VALUES (1, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         grid = excluded.grid,
         cols = excluded.cols,
         rows = excluded.rows,
         updated_at = datetime('now')`,
      [JSON.stringify(grid), cols, rows],
    );
    await this.persist();
  }

  async deleteMapGrid(): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM map_data WHERE id = 1');
    await this.persist();
  }

  // ── Zones CRUD ─────────────────────────────────────────────

  getAllZones(): ZoneRow[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM zones ORDER BY id');
    const rows: ZoneRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as ZoneRow);
    }
    stmt.free();
    return rows;
  }

  getZone(id: string): ZoneRow | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM zones WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? (stmt.getAsObject() as unknown as ZoneRow) : null;
    stmt.free();
    return row;
  }

  async upsertZone(zone: ZoneRow): Promise<void> {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO zones (id, label, bounds_x, bounds_y, bounds_w, bounds_h, poi_x, poi_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         bounds_x = excluded.bounds_x, bounds_y = excluded.bounds_y,
         bounds_w = excluded.bounds_w, bounds_h = excluded.bounds_h,
         poi_x = excluded.poi_x, poi_y = excluded.poi_y`,
      [zone.id, zone.label, zone.bounds_x, zone.bounds_y, zone.bounds_w, zone.bounds_h, zone.poi_x, zone.poi_y],
    );
    await this.persist();
  }

  async deleteZone(id: string): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM zones WHERE id = ?', [id]);
    await this.persist();
  }

  async deleteAllZones(): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM zones');
    await this.persist();
  }

  zoneCount(): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM zones');
    stmt.step();
    const count = (stmt.getAsObject() as { cnt: number }).cnt;
    stmt.free();
    return count;
  }

  // ── Tile Defs CRUD ─────────────────────────────────────────

  getAllTileDefs(): TileDefRow[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM tile_defs ORDER BY id');
    const rows: TileDefRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as TileDefRow);
    }
    stmt.free();
    return rows;
  }

  getTileDef(id: number): TileDefRow | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM tile_defs WHERE id = ?');
    stmt.bind([id]);
    const row = stmt.step() ? (stmt.getAsObject() as unknown as TileDefRow) : null;
    stmt.free();
    return row;
  }

  async upsertTileDef(def: Omit<TileDefRow, 'created_at'>): Promise<void> {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO tile_defs (id, name, char_code, walkable, interactable, sprite_data)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         char_code = excluded.char_code,
         walkable = excluded.walkable,
         interactable = excluded.interactable,
         sprite_data = excluded.sprite_data`,
      [def.id, def.name, def.char_code, def.walkable, def.interactable, def.sprite_data ?? null],
    );
    await this.persist();
  }

  async deleteTileDef(id: number): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM tile_defs WHERE id = ?', [id]);
    await this.persist();
  }

  tileDefCount(): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM tile_defs');
    stmt.step();
    const count = (stmt.getAsObject() as { cnt: number }).cnt;
    stmt.free();
    return count;
  }

  getNextTileId(): number {
    if (!this.db) return 47;
    const stmt = this.db.prepare('SELECT MAX(id) as mx FROM tile_defs');
    stmt.step();
    const mx = (stmt.getAsObject() as { mx: number | null }).mx;
    stmt.free();
    return (mx ?? 46) + 1;
  }

  async seedBuiltinTiles(): Promise<void> {
    if (!this.db) return;

    const builtins: Array<Omit<TileDefRow, 'created_at' | 'sprite_data'>> = [
      { id: 0,  name: 'Suelo',              char_code: '.', walkable: 1, interactable: 0 },
      { id: 1,  name: 'Pared',              char_code: 'W', walkable: 0, interactable: 0 },
      { id: 2,  name: 'Escritorio',          char_code: 'D', walkable: 0, interactable: 1 },
      { id: 3,  name: 'Monitor',            char_code: 'M', walkable: 0, interactable: 1 },
      { id: 4,  name: 'Estantería',         char_code: 'B', walkable: 0, interactable: 1 },
      { id: 5,  name: 'Servidor',           char_code: 'S', walkable: 0, interactable: 1 },
      { id: 6,  name: 'Planta',             char_code: 'P', walkable: 0, interactable: 0 },
      { id: 7,  name: 'Silla',              char_code: 'c', walkable: 0, interactable: 0 },
      { id: 8,  name: 'Alfombra',           char_code: 'K', walkable: 1, interactable: 0 },
      { id: 9,  name: 'Mesa',               char_code: 'T', walkable: 0, interactable: 1 },
      { id: 10, name: 'Pizarra',            char_code: 'H', walkable: 0, interactable: 1 },
      { id: 11, name: 'Cafetera',           char_code: 'F', walkable: 0, interactable: 1 },
      { id: 12, name: 'Puerta',             char_code: '_', walkable: 1, interactable: 0 },
      { id: 13, name: 'Ventana',            char_code: 'v', walkable: 0, interactable: 0 },
      { id: 14, name: 'Mampara cristal',    char_code: 'g', walkable: 0, interactable: 0 },
      { id: 15, name: 'Columna',            char_code: 'C', walkable: 0, interactable: 0 },
      { id: 16, name: 'Escaleras',          char_code: 'E', walkable: 1, interactable: 0 },
      { id: 17, name: 'Ascensor',           char_code: 'e', walkable: 0, interactable: 1 },
      { id: 18, name: 'Mesa alta',          char_code: 'd', walkable: 0, interactable: 0 },
      { id: 19, name: 'Archivador',         char_code: 'A', walkable: 0, interactable: 1 },
      { id: 20, name: 'Sofá',               char_code: 's', walkable: 0, interactable: 0 },
      { id: 21, name: 'Impresora',          char_code: 'I', walkable: 0, interactable: 1 },
      { id: 22, name: 'Papelera',           char_code: 'p', walkable: 0, interactable: 0 },
      { id: 23, name: 'Perchero',           char_code: 'h', walkable: 0, interactable: 0 },
      { id: 24, name: 'Portátil',           char_code: 'L', walkable: 0, interactable: 1 },
      { id: 25, name: 'Router',             char_code: 'R', walkable: 0, interactable: 1 },
      { id: 26, name: 'Pantalla TV',        char_code: 'V', walkable: 0, interactable: 1 },
      { id: 27, name: 'Cámara seguridad',   char_code: 'Q', walkable: 0, interactable: 0 },
      { id: 28, name: 'Nevera',             char_code: 'N', walkable: 0, interactable: 1 },
      { id: 29, name: 'Microondas',         char_code: 'm', walkable: 0, interactable: 1 },
      { id: 30, name: 'Fregadero',          char_code: 'f', walkable: 0, interactable: 1 },
      { id: 31, name: 'Máq. expendedora',   char_code: 'X', walkable: 0, interactable: 1 },
      { id: 32, name: 'Dispensador agua',   char_code: 'w', walkable: 0, interactable: 1 },
      { id: 33, name: 'Cuadro',             char_code: 'q', walkable: 0, interactable: 0 },
      { id: 34, name: 'Lámpara de pie',     char_code: 'l', walkable: 0, interactable: 0 },
      { id: 35, name: 'Reloj de pared',     char_code: 'r', walkable: 0, interactable: 0 },
      { id: 36, name: 'Trofeo',             char_code: 't', walkable: 0, interactable: 0 },
      { id: 37, name: 'Acuario',            char_code: 'a', walkable: 0, interactable: 0 },
      { id: 38, name: 'Suelo madera',       char_code: 'O', walkable: 1, interactable: 0 },
      { id: 39, name: 'Suelo baldosa',      char_code: 'Z', walkable: 1, interactable: 0 },
      { id: 40, name: 'Césped',             char_code: 'G', walkable: 1, interactable: 0 },
      { id: 41, name: 'Acera',              char_code: 'J', walkable: 1, interactable: 0 },
      { id: 42, name: 'Banco',              char_code: 'b', walkable: 0, interactable: 0 },
      { id: 43, name: 'Macetero grande',    char_code: 'n', walkable: 0, interactable: 0 },
      { id: 44, name: 'Fuente',             char_code: 'o', walkable: 0, interactable: 1 },
      { id: 45, name: 'Parking',            char_code: 'Y', walkable: 1, interactable: 0 },
      { id: 46, name: 'Señal',              char_code: 'i', walkable: 0, interactable: 1 },
    ];

    const countBefore = this.tileDefCount();
    for (const t of builtins) {
      this.db.run(
        `INSERT OR IGNORE INTO tile_defs (id, name, char_code, walkable, interactable)
         VALUES (?, ?, ?, ?, ?)`,
        [t.id, t.name, t.char_code, t.walkable, t.interactable],
      );
    }
    const inserted = this.tileDefCount() - countBefore;
    if (inserted > 0) {
      await this.persist();
      console.log(`[DB] Seeded ${inserted} built-in tile definitions (total: ${builtins.length})`);
    }
  }

  async deleteAllTileDefs(): Promise<void> {
    if (!this.db) return;
    this.db.run('DELETE FROM tile_defs');
    await this.persist();
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
