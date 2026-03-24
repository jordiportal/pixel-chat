/**
 * Procedural generation utilities for agent appearance and positioning.
 */

import { getZones, parseMapData, getWalkableSet } from '../game/map/OfficeMap';

// ── Deterministic hash for consistent generation ─────────────────

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Color generation ─────────────────────────────────────────────

const BODY_HUES = [0, 15, 30, 45, 120, 150, 180, 200, 220, 240, 260, 280, 300, 330];

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate harmonious body + hair colors from a seed string.
 */
export function generateColors(seed: string): { bodyColor: string; hairColor: string } {
  const h = hashString(seed);
  const hueIndex = h % BODY_HUES.length;
  const hue = BODY_HUES[hueIndex];

  const bodySaturation = 0.55 + (((h >> 8) % 30) / 100);
  const bodyLightness = 0.45 + (((h >> 16) % 15) / 100);
  const bodyColor = hslToHex(hue, bodySaturation, bodyLightness);

  const hairHue = (hue + 180 + ((h >> 4) % 40) - 20) % 360;
  const hairColor = hslToHex(hairHue, 0.3, 0.22 + (((h >> 12) % 10) / 100));

  return { bodyColor, hairColor };
}

// ── Position generation ──────────────────────────────────────────

const ZONE_WALKABLE_CACHE = new Map<string, Array<{ x: number; y: number }>>();

function getWalkableTiles(zone: string): Array<{ x: number; y: number }> {
  if (ZONE_WALKABLE_CACHE.has(zone)) return ZONE_WALKABLE_CACHE.get(zone)!;

  const zoneDef = getZones()[zone];
  if (!zoneDef) return [];

  const mapData = parseMapData();
  const tiles: Array<{ x: number; y: number }> = [];
  const { x: bx, y: by, w: bw, h: bh } = zoneDef.bounds;

  for (let y = by; y < by + bh; y++) {
    const row = mapData[y];
    if (!row) continue;
    for (let x = bx; x < bx + bw; x++) {
      if (getWalkableSet().has(row[x])) {
        tiles.push({ x, y });
      }
    }
  }

  ZONE_WALKABLE_CACHE.set(zone, tiles);
  return tiles;
}

const MIN_AGENT_DISTANCE = 3;

function minDistToOccupied(x: number, y: number, occupied: Set<string>): number {
  let min = Infinity;
  for (const key of occupied) {
    const [ox, oy] = key.split(',').map(Number);
    const d = Math.abs(x - ox) + Math.abs(y - oy);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Find a free walkable position inside a zone.
 * `occupied` is a set of "x,y" strings.
 * Spreads agents across the zone keeping minimum distance.
 */
export function findFreePosition(
  zone: string,
  occupied: Set<string>,
): { x: number; y: number } {
  const tiles = getWalkableTiles(zone);
  if (tiles.length === 0) return { x: 1, y: 1 };

  const poi = getZones()[zone]?.poi ?? tiles[0];

  const candidates = tiles.filter(t => !occupied.has(`${t.x},${t.y}`));
  if (candidates.length === 0) {
    return tiles[Math.floor(Math.random() * tiles.length)];
  }

  if (occupied.size === 0) {
    candidates.sort((a, b) => {
      const da = Math.abs(a.x - poi.x) + Math.abs(a.y - poi.y);
      const db = Math.abs(b.x - poi.x) + Math.abs(b.y - poi.y);
      return da - db;
    });
    return candidates[0];
  }

  const wellSpaced = candidates.filter(
    t => minDistToOccupied(t.x, t.y, occupied) >= MIN_AGENT_DISTANCE,
  );
  const pool = wellSpaced.length > 0 ? wellSpaced : candidates;

  pool.sort((a, b) => {
    const distA = minDistToOccupied(a.x, a.y, occupied);
    const distB = minDistToOccupied(b.x, b.y, occupied);
    if (distA !== distB) return distB - distA;
    const da = Math.abs(a.x - poi.x) + Math.abs(a.y - poi.y);
    const db = Math.abs(b.x - poi.x) + Math.abs(b.y - poi.y);
    return da - db;
  });

  return pool[0];
}

// ── Name generation ──────────────────────────────────────────────

/**
 * Generate a human-friendly display name from a skill ID.
 * If `rawName` is provided and looks reasonable, use it as-is.
 */
export function generateDisplayName(skillId: string, rawName?: string): string {
  if (rawName && rawName.length > 1 && !/^[a-z_-]+$/.test(rawName)) {
    return rawName;
  }

  return skillId
    .replace(/[-_]+/g, ' ')
    .replace(/agent$/i, '')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || skillId;
}

// ── Brain names generation ───────────────────────────────────────

/**
 * Generate brainNames for delegation matching.
 */
export function generateBrainNames(skillId: string, tags: string[]): string[] {
  const names = new Set<string>();

  names.add(skillId.toLowerCase());

  // Cleaned-up id without _agent suffix
  const cleaned = skillId.toLowerCase().replace(/_?agent$/, '');
  if (cleaned) names.add(cleaned);

  // Words from the ID
  for (const word of skillId.split(/[-_]/)) {
    const w = word.toLowerCase();
    if (w && w !== 'agent' && w.length > 2) names.add(w);
  }

  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t && t !== 'agent' && t !== 'chain') names.add(t);
  }

  return [...names];
}
