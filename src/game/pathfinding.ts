export interface GridPos { x: number; y: number }

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

const DIRS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

export function findPath(
  sx: number, sy: number,
  ex: number, ey: number,
  isWalkable: (x: number, y: number) => boolean,
): GridPos[] {
  if (sx === ex && sy === ey) return [{ x: sx, y: sy }];
  if (!isWalkable(ex, ey)) {
    const alt = nearestWalkable(ex, ey, isWalkable);
    if (!alt) return [];
    ex = alt.x;
    ey = alt.y;
  }

  const key = (x: number, y: number) => `${x},${y}`;
  const closed = new Set<string>();
  const open: Node[] = [];
  const heuristic = (x: number, y: number) => Math.abs(ex - x) + Math.abs(ey - y);

  const start: Node = { x: sx, y: sy, g: 0, h: heuristic(sx, sy), f: heuristic(sx, sy), parent: null };
  open.push(start);

  let iterations = 0;
  const MAX_ITER = 2000;

  while (open.length > 0 && iterations++ < MAX_ITER) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.x, cur.y);

    if (cur.x === ex && cur.y === ey) {
      const path: GridPos[] = [];
      let n: Node | null = cur;
      while (n) { path.unshift({ x: n.x, y: n.y }); n = n.parent; }
      return path;
    }

    closed.add(ck);

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = key(nx, ny);
      if (closed.has(nk) || !isWalkable(nx, ny)) continue;

      const g = cur.g + 1;
      const h = heuristic(nx, ny);
      const idx = open.findIndex(n => n.x === nx && n.y === ny);
      if (idx >= 0 && open[idx].g <= g) continue;
      if (idx >= 0) open.splice(idx, 1);

      open.push({ x: nx, y: ny, g, h, f: g + h, parent: cur });
    }
  }

  return [];
}

function nearestWalkable(tx: number, ty: number, isWalkable: (x: number, y: number) => boolean): GridPos | null {
  for (let r = 1; r <= 4; r++) {
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx * r;
      const ny = ty + dy * r;
      if (isWalkable(nx, ny)) return { x: nx, y: ny };
    }
  }
  return null;
}

export function getDirection(from: GridPos, to: GridPos): 'down' | 'up' | 'left' | 'right' {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
