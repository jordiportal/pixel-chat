/**
 * Office tilemap data and zone definitions.
 *
 * Legend (single-char → tile index):
 *   W = wall  (1)      . = floor (0)      _ = door/opening (12)
 *   D = desk  (2)      M = monitor (3)    B = bookshelf (4)
 *   S = server (5)     P = plant  (6)     c = chair  (7)
 *   K = carpet (8)     T = table  (9)     H = whiteboard (10)
 *   F = coffee (11)
 */

const CHAR_TO_TILE: Record<string, number> = {
  '.': 0, W: 1, D: 2, M: 3, B: 4, S: 5,
  P: 6, c: 7, K: 8, T: 9, H: 10, F: 11, _: 12,
};

export const TILE = {
  FLOOR: 0, WALL: 1, DESK: 2, MONITOR: 3, BOOKSHELF: 4, SERVER: 5,
  PLANT: 6, CHAIR: 7, CARPET: 8, TABLE: 9, WHITEBOARD: 10, COFFEE: 11, DOOR: 12,
} as const;

export const WALKABLE: Set<number> = new Set([TILE.FLOOR, TILE.CARPET, TILE.DOOR]);

export const MAP_COLS = 32;
export const MAP_ROWS = 24;
export const TILE_SIZE = 16;

// prettier-ignore
const MAP_STRINGS: string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 0
  'W.....DM..DM...W..BB..BB..BB...W', // 1
  'W.....c...c....W...............W', // 2
  'W..............W..BB..BB..BB...W', // 3
  'W..P..DM.......W...............W', // 4
  'W.....c..P.....W.......Dc......W', // 5
  'W..............W.......Dc......W', // 6
  'W..........F...W...............W', // 7
  'W..............W..BB..BB.......W', // 8
  'W..............W...............W', // 9
  'WWWWWW__WWWWWWWWWWWWWW__WWWWWWWW', // 10
  'W..............W...............W', // 11
  'W.SS....SS.....W...DM....DM....W', // 12
  'W..............W...c.....c.....W', // 13
  'W.SS....SS.....W...............W', // 14
  'W..............W...DM....DM....W', // 15
  'W..............W...c.....c.....W', // 16
  'W..............W...............W', // 17
  'WWWWWWWWW__WWWWWWWW__WWWWWWWWWWW', // 18
  'W..............................W', // 19
  'W.....TTTTTTTTTTTTTT...........W', // 20
  'W.....TTTTTTTTTTTTTT.......H...W', // 21
  'W..............................W', // 22
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 23
];

export function parseMapData(): number[][] {
  return MAP_STRINGS.map((row, r) => {
    if (row.length !== MAP_COLS) {
      console.warn(`Row ${r} has ${row.length} cols, expected ${MAP_COLS}`);
    }
    return Array.from(row).map(ch => CHAR_TO_TILE[ch] ?? 0);
  });
}

export interface Point { x: number; y: number }

export interface ZoneDef {
  name: string;
  label: string;
  bounds: { x: number; y: number; w: number; h: number };
  poi: Point;          // point-of-interest agents walk to
}

export const ZONES: Record<string, ZoneDef> = {
  mainOffice: {
    name: 'mainOffice', label: 'Oficina Principal',
    bounds: { x: 1, y: 1, w: 14, h: 9 },
    poi: { x: 8, y: 4 },
  },
  library: {
    name: 'library', label: 'Biblioteca',
    bounds: { x: 16, y: 1, w: 15, h: 9 },
    poi: { x: 24, y: 4 },
  },
  serverRoom: {
    name: 'serverRoom', label: 'Sala de Servidores',
    bounds: { x: 1, y: 11, w: 14, h: 7 },
    poi: { x: 6, y: 13 },
  },
  webCorner: {
    name: 'webCorner', label: 'Web Corner',
    bounds: { x: 16, y: 11, w: 15, h: 7 },
    poi: { x: 23, y: 14 },
  },
  meetingRoom: {
    name: 'meetingRoom', label: 'Sala de Reuniones',
    bounds: { x: 1, y: 19, w: 30, h: 4 },
    poi: { x: 4, y: 20 },
  },
};

export const ACTION_TYPE_TO_ZONE: Record<string, string> = {
  web_search:  'webCorner',
  web_fetch:   'webCorner',
  python:      'serverRoom',
  shell:       'serverRoom',
  javascript:  'serverRoom',
  code_exec:   'serverRoom',
  file_read:   'mainOffice',
  file_write:  'mainOffice',
  image:       'library',
  slides:      'library',
  delegate:    'meetingRoom',
  data:        'mainOffice',
  summarizing: 'mainOffice',
  planning:    'mainOffice',
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
