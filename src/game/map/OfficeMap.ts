/**
 * Office tilemap data and zone definitions.
 *
 * Legend (single-char -> tile index):
 *   W = wall  (1)      . = floor (0)      _ = door/opening (12)
 *   D = desk  (2)      M = monitor (3)    B = bookshelf (4)
 *   S = server (5)     P = plant  (6)     c = chair  (7)
 *   K = carpet (8)     T = table  (9)     H = whiteboard (10)
 *   F = coffee (11)
 */

import { db, type ZoneRow } from '../../db/Database';
import { tileRegistry } from '../../services/TileRegistry';

export const TILE = {
  FLOOR: 0, WALL: 1, DESK: 2, MONITOR: 3, BOOKSHELF: 4, SERVER: 5,
  PLANT: 6, CHAIR: 7, CARPET: 8, TABLE: 9, WHITEBOARD: 10, COFFEE: 11, DOOR: 12,
  WINDOW: 13, GLASS_WALL: 14, COLUMN: 15, STAIRS: 16, ELEVATOR: 17,
  STANDING_DESK: 18, FILING_CABINET: 19, SOFA: 20, PRINTER: 21, TRASH_BIN: 22, COAT_RACK: 23,
  LAPTOP: 24, ROUTER: 25, TV_SCREEN: 26, SECURITY_CAM: 27,
  FRIDGE: 28, MICROWAVE: 29, SINK: 30, VENDING_MACHINE: 31, WATER_COOLER: 32,
  PAINTING: 33, FLOOR_LAMP: 34, WALL_CLOCK: 35, TROPHY: 36, AQUARIUM: 37,
  WOOD_FLOOR: 38, TILE_FLOOR: 39, GRASS: 40, SIDEWALK: 41,
  BENCH: 42, PLANTER: 43, FOUNTAIN: 44, PARKING: 45, SIGN: 46,
} as const;

/** @deprecated Use tileRegistry.count */
export function getTileCount(): number { return tileRegistry.count || 13; }
/** @deprecated Use tileRegistry.getName(id) */
export function getTileName(id: number): string { return tileRegistry.getName(id); }
/** @deprecated Use tileRegistry.walkableSet */
export function getWalkableSet(): Set<number> {
  const s = tileRegistry.walkableSet;
  return s.size > 0 ? s : new Set([TILE.FLOOR, TILE.CARPET, TILE.DOOR]);
}

export function getCharToTile(): Record<string, number> {
  const m = tileRegistry.getCharToTile();
  if (Object.keys(m).length > 0) return m;
  return { '.': 0, W: 1, D: 2, M: 3, B: 4, S: 5, P: 6, c: 7, K: 8, T: 9, H: 10, F: 11, _: 12 };
}

export function getTileToChar(): Record<number, string> {
  const m = tileRegistry.getTileToChar();
  if (Object.keys(m).length > 0) return m;
  return Object.fromEntries(
    Object.entries(getCharToTile()).map(([ch, idx]) => [idx, ch]),
  );
}

export function getTileNames(): Record<number, string> {
  const m = tileRegistry.getNames();
  if (Object.keys(m).length > 0) return m;
  return {
    0: 'Suelo', 1: 'Pared', 2: 'Escritorio', 3: 'Monitor',
    4: 'Estantería', 5: 'Servidor', 6: 'Planta', 7: 'Silla',
    8: 'Alfombra', 9: 'Mesa', 10: 'Pizarra', 11: 'Cafetera', 12: 'Puerta',
  };
}

/** Backward-compat static aliases — prefer the dynamic functions above */
export const CHAR_TO_TILE: Record<string, number> = {
  '.': 0, W: 1, D: 2, M: 3, B: 4, S: 5,
  P: 6, c: 7, K: 8, T: 9, H: 10, F: 11, _: 12,
};
export const TILE_TO_CHAR: Record<number, string> = Object.fromEntries(
  Object.entries(CHAR_TO_TILE).map(([ch, idx]) => [idx, ch]),
);
export const TILE_NAMES: Record<number, string> = {
  0: 'Suelo', 1: 'Pared', 2: 'Escritorio', 3: 'Monitor',
  4: 'Estantería', 5: 'Servidor', 6: 'Planta', 7: 'Silla',
  8: 'Alfombra', 9: 'Mesa', 10: 'Pizarra', 11: 'Cafetera', 12: 'Puerta',
};
export const TILE_COUNT = 47;
export const WALKABLE: Set<number> = new Set([
  TILE.FLOOR, TILE.CARPET, TILE.DOOR, TILE.STAIRS,
  TILE.WOOD_FLOOR, TILE.TILE_FLOOR, TILE.GRASS, TILE.SIDEWALK, TILE.PARKING,
]);

export const MAP_COLS = 32;
export const MAP_ROWS = 24;
export const TILE_SIZE = 32;

// prettier-ignore
export const DEFAULT_MAP_STRINGS: string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 0
  'W.DM..DM..P....W.BB.......BB...W', // 1  mainOffice         | creativeStudio
  'W.c...c........W...............W', // 2  desks + monitors   | bookshelves (RAG/ref)
  'W..........DM..W.BB.......BB...W', // 3  + coffee + plant   | + desks for design
  'W..P.......c...W...............W', // 4
  'W.DM.......F...W.......DM......W', // 5
  'W.c............W.......c.......W', // 6
  'W..............W..P....DM......W', // 7
  'W..............W.......c.......W', // 8
  'W..............W...............W', // 9
  'WWWWWW__WWWWWWWWWWWWWW__WWWWWWWW', // 10
  'W..............W...............W', // 11 serverRoom         | researchLab
  'W.SS....SS.....W...DM....DM....W', // 12 servers for code   | desks for web research
  'W..............W...c.....c.....W', // 13
  'W.SS....SS.....W...............W', // 14
  'W..............W...DM....DM....W', // 15
  'W..........P...W...c.....c.....W', // 16
  'W..............W..........BB...W', // 17                    | + bookshelves (RAG)
  'WWWWWWWWW__WWWWWWWW__WWWWWWWWWWW', // 18
  'W..............W...............W', // 19 meetingRoomA        | meetingRoomB
  'W.TTTTTTT..H...W..TTTTTTT..H...W', // 20 table + whiteboard | table + whiteboard
  'W.TTTTTTT......W..TTTTTTT......W', // 21
  'W..............W...............W', // 22
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 23
];

export function defaultMapGrid(): number[][] {
  return DEFAULT_MAP_STRINGS.map(row =>
    Array.from(row).map(ch => CHAR_TO_TILE[ch] ?? 0),
  );
}

/**
 * Get the map grid: reads from DB first, falls back to default.
 * Synchronous — DB must already be initialized.
 */
export function parseMapData(): number[][] {
  const fromDb = db.getMapGrid();
  if (fromDb && fromDb.length === MAP_ROWS && fromDb[0]?.length === MAP_COLS) {
    return fromDb;
  }
  return defaultMapGrid();
}

export interface Point { x: number; y: number }

export interface ZoneDef {
  name: string;
  label: string;
  bounds: { x: number; y: number; w: number; h: number };
  poi: Point;
}

export const DEFAULT_ZONES: Record<string, ZoneDef> = {
  mainOffice: {
    name: 'mainOffice', label: 'Oficina Principal',
    bounds: { x: 1, y: 1, w: 14, h: 9 },
    poi: { x: 5, y: 4 },
  },
  creativeStudio: {
    name: 'creativeStudio', label: 'Estudio Creativo',
    bounds: { x: 16, y: 1, w: 15, h: 9 },
    poi: { x: 21, y: 5 },
  },
  serverRoom: {
    name: 'serverRoom', label: 'Sala de Servidores',
    bounds: { x: 1, y: 11, w: 14, h: 7 },
    poi: { x: 6, y: 13 },
  },
  researchLab: {
    name: 'researchLab', label: 'Lab. Investigación',
    bounds: { x: 16, y: 11, w: 15, h: 7 },
    poi: { x: 22, y: 13 },
  },
  meetingRoomA: {
    name: 'meetingRoomA', label: 'Sala Reuniones A',
    bounds: { x: 1, y: 19, w: 14, h: 4 },
    poi: { x: 9, y: 20 },
  },
  meetingRoomB: {
    name: 'meetingRoomB', label: 'Sala Reuniones B',
    bounds: { x: 16, y: 19, w: 15, h: 4 },
    poi: { x: 25, y: 20 },
  },
};

function zoneRowToDef(row: ZoneRow): ZoneDef {
  return {
    name: row.id,
    label: row.label,
    bounds: { x: row.bounds_x, y: row.bounds_y, w: row.bounds_w, h: row.bounds_h },
    poi: { x: row.poi_x, y: row.poi_y },
  };
}

/** Get zones: reads from DB first, falls back to defaults. */
export function getZones(): Record<string, ZoneDef> {
  const rows = db.getAllZones();
  if (rows.length > 0) {
    const result: Record<string, ZoneDef> = {};
    for (const r of rows) result[r.id] = zoneRowToDef(r);
    return result;
  }
  return { ...DEFAULT_ZONES };
}

/** Backward-compat alias — points to live zones */
export const ZONES: Record<string, ZoneDef> = DEFAULT_ZONES;

export const ACTION_TYPE_TO_ZONE: Record<string, string> = {
  web_search:  'researchLab',
  web_fetch:   'researchLab',
  rag_search:  'researchLab',
  rag_ingest:  'researchLab',
  python:      'serverRoom',
  shell:       'serverRoom',
  javascript:  'serverRoom',
  code_exec:   'serverRoom',
  file_read:   'mainOffice',
  file_write:  'mainOffice',
  data:        'mainOffice',
  summarizing: 'mainOffice',
  email:       'mainOffice',
  calendar:    'mainOffice',
  m365:        'mainOffice',
  sap:         'mainOffice',
  calculate:   'mainOffice',
  think:       'mainOffice',
  reflect:     'mainOffice',
  image:       'creativeStudio',
  slides:      'creativeStudio',
  blender:     'creativeStudio',
  delegate:    'meetingRoomA',
  planning:    'meetingRoomA',
};

export interface AgentDef {
  id: string;
  name: string;
  bodyColor: string;
  hairColor: string;
  homeX: number;
  homeY: number;
  zone: string;
  brainNames: string[];
}

export { agentRegistry } from './AgentRegistry';
