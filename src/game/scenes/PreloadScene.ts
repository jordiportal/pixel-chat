import Phaser from 'phaser';
import { TILE_SIZE, TILE, type AgentDef } from '../map/OfficeMap';
import { agentRegistry } from '../map/AgentRegistry';

const TILE_COUNT = 13;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    this.buildTileset();

    const agents = agentRegistry.getAgents();
    for (const def of agents) {
      buildAgentTextures(this, def);
    }

    this.scene.start('OfficeScene');
  }

  /* ─── Tileset (canvas texture) ─── */

  private buildTileset(): void {
    const S = TILE_SIZE;
    const tex = this.textures.createCanvas('tiles', TILE_COUNT * S, S);
    const ctx = tex!.getContext();

    for (let i = 0; i < TILE_COUNT; i++) {
      drawTile(ctx, i * S, i);
    }

    tex!.refresh();
  }
}

/* ─── Public helpers for dynamic agent texture creation ─── */

export function buildAgentTextures(scene: Phaser.Scene, def: AgentDef): void {
  const key = `agent-${def.id}`;

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }

  const S = TILE_SIZE;
  const cols = 3;
  const rows = 4;

  const tex = scene.textures.createCanvas(key, cols * S, rows * S);
  const ctx = tex!.getContext();

  const dirs: Array<'down' | 'left' | 'right' | 'up'> = ['down', 'left', 'right', 'up'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawAgentFrame(ctx, c * S, r * S, def.bodyColor, def.hairColor, dirs[r], c);
    }
  }
  tex!.refresh();

  const texture = scene.textures.get(key);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      texture.add(r * cols + c, 0, c * S, r * S, S, S);
    }
  }

  createAgentAnimations(scene, def);
}

function createAgentAnimations(scene: Phaser.Scene, def: AgentDef): void {
  const dirs = ['down', 'left', 'right', 'up'];
  const k = `agent-${def.id}`;

  for (let d = 0; d < 4; d++) {
    const base = d * 3;
    const idleKey = `${def.id}-idle-${dirs[d]}`;
    const walkKey = `${def.id}-walk-${dirs[d]}`;

    if (scene.anims.exists(idleKey)) scene.anims.remove(idleKey);
    if (scene.anims.exists(walkKey)) scene.anims.remove(walkKey);

    scene.anims.create({
      key: idleKey,
      frames: [{ key: k, frame: base }],
      frameRate: 1,
      repeat: -1,
    });

    scene.anims.create({
      key: walkKey,
      frames: [
        { key: k, frame: base + 1 },
        { key: k, frame: base },
        { key: k, frame: base + 2 },
        { key: k, frame: base },
      ],
      frameRate: 8,
      repeat: -1,
    });
  }
}

/* ─── Tile drawing ─── */

function drawTile(ctx: CanvasRenderingContext2D, x: number, idx: number): void {
  const S = TILE_SIZE;
  ctx.clearRect(x, 0, S, S);

  switch (idx) {
    case TILE.FLOOR: {
      ctx.fillStyle = '#c8b89a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#bbaa82';
      ctx.fillRect(x, 0, S, 1);
      ctx.fillRect(x, 0, 1, S);
      break;
    }
    case TILE.WALL: {
      ctx.fillStyle = '#3a3a5e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#4a4a70';
      ctx.fillRect(x, 0, S, 3);
      ctx.fillStyle = '#30304a';
      ctx.fillRect(x, S - 2, S, 2);
      ctx.fillStyle = '#44445e';
      for (let by = 4; by < S - 2; by += 4) {
        ctx.fillRect(x, by, S, 1);
      }
      break;
    }
    case TILE.DESK: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#8b6b3e';
      ctx.fillRect(x + 1, 2, 14, 12);
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(x + 1, 12, 14, 2);
      break;
    }
    case TILE.MONITOR: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(x + 3, 1, 10, 8);
      ctx.fillStyle = '#1a3a2a';
      ctx.fillRect(x + 4, 2, 8, 6);
      ctx.fillStyle = '#40cc60';
      ctx.fillRect(x + 5, 3, 2, 1);
      ctx.fillRect(x + 5, 5, 4, 1);
      ctx.fillRect(x + 5, 7, 3, 1);
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(x + 7, 9, 2, 3);
      ctx.fillRect(x + 5, 12, 6, 1);
      break;
    }
    case TILE.BOOKSHELF: {
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#4a2a10';
      ctx.fillRect(x, 0, S, 1);
      ctx.fillRect(x, 5, S, 1);
      ctx.fillRect(x, 10, S, 1);
      const colors = ['#cc4444', '#4488cc', '#44aa44', '#ccaa44', '#aa44aa', '#44cccc'];
      for (let row = 0; row < 3; row++) {
        for (let b = 0; b < 5; b++) {
          ctx.fillStyle = colors[(row * 5 + b) % colors.length];
          ctx.fillRect(x + 1 + b * 3, row * 5 + 1, 2, 4);
        }
      }
      break;
    }
    case TILE.SERVER: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#3a4a5a';
      ctx.fillRect(x + 2, 0, 12, 14);
      ctx.fillStyle = '#2a3a4a';
      ctx.fillRect(x + 3, 1, 10, 3);
      ctx.fillRect(x + 3, 5, 10, 3);
      ctx.fillRect(x + 3, 9, 10, 3);
      ctx.fillStyle = '#40dd60';
      ctx.fillRect(x + 11, 2, 1, 1);
      ctx.fillStyle = '#dd4040';
      ctx.fillRect(x + 11, 6, 1, 1);
      ctx.fillStyle = '#40dd60';
      ctx.fillRect(x + 11, 10, 1, 1);
      break;
    }
    case TILE.PLANT: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#7b5b2e';
      ctx.fillRect(x + 5, 10, 6, 5);
      ctx.fillStyle = '#3a8a3a';
      ctx.fillRect(x + 4, 4, 8, 7);
      ctx.fillStyle = '#4aaa4a';
      ctx.fillRect(x + 5, 3, 6, 5);
      ctx.fillStyle = '#5abb5a';
      ctx.fillRect(x + 6, 2, 4, 3);
      break;
    }
    case TILE.CHAIR: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(x + 4, 4, 8, 8);
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(x + 5, 5, 6, 6);
      break;
    }
    case TILE.CARPET: {
      ctx.fillStyle = '#7a6a9a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#6a5a8a';
      ctx.fillRect(x, 0, S, 1);
      ctx.fillRect(x, 0, 1, S);
      break;
    }
    case TILE.TABLE: {
      ctx.fillStyle = '#9a7a5a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(x, 0, S, 1);
      ctx.fillRect(x, 0, 1, S);
      ctx.fillRect(x + S - 1, 0, 1, S);
      ctx.fillRect(x, S - 1, S, 1);
      break;
    }
    case TILE.WHITEBOARD: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#e0e0e8';
      ctx.fillRect(x + 1, 1, 14, 10);
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(x + 1, 1, 14, 1);
      ctx.fillStyle = '#cc4444';
      ctx.fillRect(x + 3, 4, 5, 1);
      ctx.fillStyle = '#4444cc';
      ctx.fillRect(x + 4, 6, 6, 1);
      ctx.fillStyle = '#44aa44';
      ctx.fillRect(x + 3, 8, 4, 1);
      break;
    }
    case TILE.COFFEE: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(x + 4, 2, 8, 12);
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(x + 5, 3, 6, 4);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + 5, 7, 6, 2);
      ctx.fillStyle = '#dd4444';
      ctx.fillRect(x + 5, 10, 2, 2);
      break;
    }
    case TILE.DOOR: {
      ctx.fillStyle = '#d4c8a0';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#c4b890';
      ctx.fillRect(x, 7, S, 2);
      break;
    }
  }
}

function drawAgentFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  body: string, hair: string,
  dir: 'down' | 'left' | 'right' | 'up',
  frame: number,
): void {
  const eye = '#1a1a2e';
  const skin = '#f0c890';
  const pants = '#384058';
  const shoe = '#28282e';

  const p = (cx: number, cy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + cx, y + cy, w, h);
  };

  if (dir === 'down' || dir === 'left' || dir === 'right') {
    p(5, 0, 6, 3, hair);
    p(5, 3, 6, 3, skin);
    if (dir === 'down') {
      p(6, 4, 1, 1, eye);
      p(9, 4, 1, 1, eye);
    } else if (dir === 'left') {
      p(5, 4, 1, 1, eye);
    } else {
      p(10, 4, 1, 1, eye);
    }
  } else {
    p(5, 0, 6, 6, hair);
  }

  p(4, 6, 8, 4, body);
  if (dir === 'left') p(3, 6, 1, 3, body);
  if (dir === 'right') p(12, 6, 1, 3, body);

  p(5, 10, 6, 2, pants);

  const shift = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  p(5 + shift, 12, 2, 2, shoe);
  p(9 - shift, 12, 2, 2, shoe);
}
