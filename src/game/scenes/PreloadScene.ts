import Phaser from 'phaser';
import { TILE_SIZE, TILE, getTileCount, type AgentDef } from '../map/OfficeMap';
import { tileRegistry } from '../../services/TileRegistry';
import { agentRegistry } from '../map/AgentRegistry';
import { getAgentAccessory, type AccessoryType } from '../constants/AgentAccessories';

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
    const count = getTileCount();
    const tex = this.textures.createCanvas('tiles', count * S, S);
    const ctx = tex!.getContext();

    for (let i = 0; i < count; i++) {
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

  const accessory = getAgentAccessory(def.brainNames);
  const dirs: Array<'down' | 'left' | 'right' | 'up'> = ['down', 'left', 'right', 'up'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawAgentFrame(ctx, c * S, r * S, def.bodyColor, def.hairColor, dirs[r], c);
      if (accessory !== 'none') {
        drawAccessory(ctx, c * S, r * S, accessory, dirs[r]);
      }
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

export function drawTile(ctx: CanvasRenderingContext2D, x: number, idx: number): void {
  const S = TILE_SIZE;
  const F = S / 16;
  ctx.clearRect(x, 0, S, S);

  const sprite = tileRegistry.getSpriteImage(idx);
  if (sprite) {
    ctx.drawImage(sprite, x, 0, S, S);
    return;
  }

  switch (idx) {
    case TILE.FLOOR: {
      ctx.fillStyle = '#c8b89a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#bbaa82';
      ctx.fillRect(x, 0, S, F);
      ctx.fillRect(x, 0, F, S);
      break;
    }
    case TILE.WALL: {
      ctx.fillStyle = '#3a3a5e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#4a4a70';
      ctx.fillRect(x, 0, S, 3 * F);
      ctx.fillStyle = '#30304a';
      ctx.fillRect(x, S - 2 * F, S, 2 * F);
      ctx.fillStyle = '#44445e';
      for (let by = 4 * F; by < S - 2 * F; by += 4 * F) {
        ctx.fillRect(x, by, S, F);
      }
      break;
    }
    case TILE.DESK: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#8b6b3e';
      ctx.fillRect(x + 1 * F, 2 * F, 14 * F, 12 * F);
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(x + 1 * F, 12 * F, 14 * F, 2 * F);
      break;
    }
    case TILE.MONITOR: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(x + 3 * F, 1 * F, 10 * F, 8 * F);
      ctx.fillStyle = '#1a3a2a';
      ctx.fillRect(x + 4 * F, 2 * F, 8 * F, 6 * F);
      ctx.fillStyle = '#40cc60';
      ctx.fillRect(x + 5 * F, 3 * F, 2 * F, F);
      ctx.fillRect(x + 5 * F, 5 * F, 4 * F, F);
      ctx.fillRect(x + 5 * F, 7 * F, 3 * F, F);
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(x + 7 * F, 9 * F, 2 * F, 3 * F);
      ctx.fillRect(x + 5 * F, 12 * F, 6 * F, F);
      break;
    }
    case TILE.BOOKSHELF: {
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#4a2a10';
      ctx.fillRect(x, 0, S, F);
      ctx.fillRect(x, 5 * F, S, F);
      ctx.fillRect(x, 10 * F, S, F);
      const colors = ['#cc4444', '#4488cc', '#44aa44', '#ccaa44', '#aa44aa', '#44cccc'];
      for (let row = 0; row < 3; row++) {
        for (let b = 0; b < 5; b++) {
          ctx.fillStyle = colors[(row * 5 + b) % colors.length];
          ctx.fillRect(x + (1 + b * 3) * F, (row * 5 + 1) * F, 2 * F, 4 * F);
        }
      }
      break;
    }
    case TILE.SERVER: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#3a4a5a';
      ctx.fillRect(x + 2 * F, 0, 12 * F, 14 * F);
      ctx.fillStyle = '#2a3a4a';
      ctx.fillRect(x + 3 * F, 1 * F, 10 * F, 3 * F);
      ctx.fillRect(x + 3 * F, 5 * F, 10 * F, 3 * F);
      ctx.fillRect(x + 3 * F, 9 * F, 10 * F, 3 * F);
      ctx.fillStyle = '#40dd60';
      ctx.fillRect(x + 11 * F, 2 * F, F, F);
      ctx.fillStyle = '#dd4040';
      ctx.fillRect(x + 11 * F, 6 * F, F, F);
      ctx.fillStyle = '#40dd60';
      ctx.fillRect(x + 11 * F, 10 * F, F, F);
      break;
    }
    case TILE.PLANT: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#7b5b2e';
      ctx.fillRect(x + 5 * F, 10 * F, 6 * F, 5 * F);
      ctx.fillStyle = '#3a8a3a';
      ctx.fillRect(x + 4 * F, 4 * F, 8 * F, 7 * F);
      ctx.fillStyle = '#4aaa4a';
      ctx.fillRect(x + 5 * F, 3 * F, 6 * F, 5 * F);
      ctx.fillStyle = '#5abb5a';
      ctx.fillRect(x + 6 * F, 2 * F, 4 * F, 3 * F);
      break;
    }
    case TILE.CHAIR: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(x + 4 * F, 4 * F, 8 * F, 8 * F);
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(x + 5 * F, 5 * F, 6 * F, 6 * F);
      break;
    }
    case TILE.CARPET: {
      ctx.fillStyle = '#7a6a9a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#6a5a8a';
      ctx.fillRect(x, 0, S, F);
      ctx.fillRect(x, 0, F, S);
      break;
    }
    case TILE.TABLE: {
      ctx.fillStyle = '#9a7a5a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(x, 0, S, F);
      ctx.fillRect(x, 0, F, S);
      ctx.fillRect(x + S - F, 0, F, S);
      ctx.fillRect(x, S - F, S, F);
      break;
    }
    case TILE.WHITEBOARD: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#e0e0e8';
      ctx.fillRect(x + 1 * F, 1 * F, 14 * F, 10 * F);
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(x + 1 * F, 1 * F, 14 * F, F);
      ctx.fillStyle = '#cc4444';
      ctx.fillRect(x + 3 * F, 4 * F, 5 * F, F);
      ctx.fillStyle = '#4444cc';
      ctx.fillRect(x + 4 * F, 6 * F, 6 * F, F);
      ctx.fillStyle = '#44aa44';
      ctx.fillRect(x + 3 * F, 8 * F, 4 * F, F);
      break;
    }
    case TILE.COFFEE: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(x + 4 * F, 2 * F, 8 * F, 12 * F);
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(x + 5 * F, 3 * F, 6 * F, 4 * F);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + 5 * F, 7 * F, 6 * F, 2 * F);
      ctx.fillStyle = '#dd4444';
      ctx.fillRect(x + 5 * F, 10 * F, 2 * F, 2 * F);
      break;
    }
    case TILE.DOOR: {
      ctx.fillStyle = '#d4c8a0';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#c4b890';
      ctx.fillRect(x, 7 * F, S, 2 * F);
      break;
    }
    case TILE.WINDOW: {
      ctx.fillStyle = '#3a3a5e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#555580';
      ctx.fillRect(x + 2 * F, 2 * F, 12 * F, 12 * F);
      ctx.fillStyle = '#88bbdd';
      ctx.fillRect(x + 3 * F, 3 * F, 10 * F, 10 * F);
      ctx.fillStyle = '#555580';
      ctx.fillRect(x + 7.5 * F, 3 * F, F, 10 * F);
      ctx.fillRect(x + 3 * F, 7.5 * F, 10 * F, F);
      ctx.fillStyle = '#aaddee';
      ctx.fillRect(x + 4 * F, 4 * F, 3 * F, 2 * F);
      break;
    }
    case TILE.GLASS_WALL: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#8abbd8';
      ctx.fillRect(x + 7 * F, 0, 2 * F, S);
      ctx.fillStyle = '#aaddee';
      ctx.fillRect(x + 7.5 * F, 0, F, S);
      ctx.fillStyle = '#667788';
      ctx.fillRect(x + 7 * F, 0, 2 * F, F);
      ctx.fillRect(x + 7 * F, S - F, 2 * F, F);
      break;
    }
    case TILE.COLUMN: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#888899';
      ctx.fillRect(x + 5 * F, 3 * F, 6 * F, 10 * F);
      ctx.fillStyle = '#9999aa';
      ctx.fillRect(x + 4 * F, 3 * F, 8 * F, 2 * F);
      ctx.fillRect(x + 4 * F, 11 * F, 8 * F, 2 * F);
      ctx.fillStyle = '#aaaabb';
      ctx.fillRect(x + 6 * F, 4 * F, 2 * F, 8 * F);
      break;
    }
    case TILE.STAIRS: {
      ctx.fillStyle = '#9a8a7a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#b0a090';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x, i * 3 * F, S, 2 * F);
      }
      ctx.fillStyle = '#8a7a6a';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x, i * 3 * F + 2 * F, S, F);
      }
      break;
    }
    case TILE.ELEVATOR: {
      ctx.fillStyle = '#707080';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#8a8a9a';
      ctx.fillRect(x + 2 * F, F, 5 * F, 13 * F);
      ctx.fillRect(x + 9 * F, F, 5 * F, 13 * F);
      ctx.fillStyle = '#606070';
      ctx.fillRect(x + 7 * F, F, 2 * F, 13 * F);
      ctx.fillStyle = '#ccbb44';
      ctx.fillRect(x + 7.5 * F, 6 * F, F, F);
      break;
    }
    case TILE.STANDING_DESK: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a5a6a';
      ctx.fillRect(x + 3 * F, 10 * F, F, 5 * F);
      ctx.fillRect(x + 12 * F, 10 * F, F, 5 * F);
      ctx.fillStyle = '#8a7a5a';
      ctx.fillRect(x + 2 * F, 8 * F, 12 * F, 2 * F);
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(x + 2 * F, 8 * F, 12 * F, F);
      break;
    }
    case TILE.FILING_CABINET: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#6a7a8a';
      ctx.fillRect(x + 3 * F, F, 10 * F, 14 * F);
      ctx.fillStyle = '#5a6a7a';
      ctx.fillRect(x + 3 * F, F, 10 * F, F);
      ctx.fillRect(x + 3 * F, 5 * F, 10 * F, F);
      ctx.fillRect(x + 3 * F, 9 * F, 10 * F, F);
      ctx.fillStyle = '#aabbcc';
      ctx.fillRect(x + 7 * F, 3 * F, 2 * F, F);
      ctx.fillRect(x + 7 * F, 7 * F, 2 * F, F);
      ctx.fillRect(x + 7 * F, 11 * F, 2 * F, F);
      break;
    }
    case TILE.SOFA: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#6a4a8a';
      ctx.fillRect(x + F, 4 * F, 14 * F, 10 * F);
      ctx.fillStyle = '#7a5a9a';
      ctx.fillRect(x + 2 * F, 6 * F, 12 * F, 7 * F);
      ctx.fillStyle = '#5a3a7a';
      ctx.fillRect(x + F, 4 * F, 14 * F, 2 * F);
      break;
    }
    case TILE.PRINTER: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#e8e0d8';
      ctx.fillRect(x + 2 * F, 3 * F, 12 * F, 10 * F);
      ctx.fillStyle = '#d0c8c0';
      ctx.fillRect(x + 2 * F, 3 * F, 12 * F, 2 * F);
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(x + 4 * F, F, 8 * F, 2 * F);
      ctx.fillStyle = '#44aa44';
      ctx.fillRect(x + 11 * F, 6 * F, F, F);
      ctx.fillStyle = '#4a6a8a';
      ctx.fillRect(x + 4 * F, 11 * F, 8 * F, 2 * F);
      break;
    }
    case TILE.TRASH_BIN: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a6a5a';
      ctx.fillRect(x + 5 * F, 5 * F, 6 * F, 10 * F);
      ctx.fillStyle = '#4a5a4a';
      ctx.fillRect(x + 4 * F, 4 * F, 8 * F, 2 * F);
      ctx.fillStyle = '#6a7a6a';
      ctx.fillRect(x + 6 * F, 7 * F, 4 * F, 6 * F);
      break;
    }
    case TILE.COAT_RACK: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(x + 7 * F, 2 * F, 2 * F, 12 * F);
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(x + 5 * F, 14 * F, 6 * F, F);
      ctx.fillRect(x + 4 * F, 2 * F, 8 * F, F);
      ctx.fillRect(x + 3 * F, 3 * F, F, 2 * F);
      ctx.fillRect(x + 12 * F, 3 * F, F, 2 * F);
      break;
    }
    case TILE.LAPTOP: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(x + 3 * F, 2 * F, 10 * F, 7 * F);
      ctx.fillStyle = '#2244aa';
      ctx.fillRect(x + 4 * F, 3 * F, 8 * F, 5 * F);
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(x + 2 * F, 9 * F, 12 * F, 5 * F);
      ctx.fillStyle = '#5a5a6a';
      ctx.fillRect(x + 3 * F, 10 * F, 10 * F, 3 * F);
      break;
    }
    case TILE.ROUTER: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#2a3a4a';
      ctx.fillRect(x + 2 * F, 5 * F, 12 * F, 6 * F);
      ctx.fillStyle = '#1a2a3a';
      ctx.fillRect(x + 2 * F, 5 * F, 12 * F, F);
      ctx.fillStyle = '#40dd60';
      ctx.fillRect(x + 4 * F, 8 * F, F, F);
      ctx.fillRect(x + 6 * F, 8 * F, F, F);
      ctx.fillStyle = '#ddaa40';
      ctx.fillRect(x + 8 * F, 8 * F, F, F);
      ctx.fillStyle = '#40dd60';
      ctx.fillRect(x + 10 * F, 8 * F, F, F);
      ctx.fillStyle = '#3a4a5a';
      ctx.fillRect(x + 3 * F, 2 * F, F, 3 * F);
      ctx.fillRect(x + 12 * F, 2 * F, F, 3 * F);
      break;
    }
    case TILE.TV_SCREEN: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(x + F, F, 14 * F, 10 * F);
      ctx.fillStyle = '#2255bb';
      ctx.fillRect(x + 2 * F, 2 * F, 12 * F, 8 * F);
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(x + 6 * F, 11 * F, 4 * F, 2 * F);
      ctx.fillRect(x + 4 * F, 13 * F, 8 * F, F);
      break;
    }
    case TILE.SECURITY_CAM: {
      ctx.fillStyle = '#3a3a5e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#4a4a70';
      ctx.fillRect(x, 0, S, 3 * F);
      ctx.fillStyle = '#555566';
      ctx.fillRect(x + 4 * F, 4 * F, 2 * F, 3 * F);
      ctx.fillRect(x + 3 * F, 5 * F, 6 * F, 3 * F);
      ctx.fillStyle = '#333344';
      ctx.fillRect(x + 8 * F, 6 * F, 3 * F, 2 * F);
      ctx.fillStyle = '#dd3333';
      ctx.fillRect(x + 5 * F, 5 * F, F, F);
      break;
    }
    case TILE.FRIDGE: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#dddddd';
      ctx.fillRect(x + 3 * F, 0, 10 * F, 15 * F);
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(x + 3 * F, 8 * F, 10 * F, F);
      ctx.fillStyle = '#bbbbbb';
      ctx.fillRect(x + 3 * F, 0, 10 * F, F);
      ctx.fillStyle = '#999999';
      ctx.fillRect(x + 11 * F, 2 * F, F, 5 * F);
      ctx.fillRect(x + 11 * F, 10 * F, F, 4 * F);
      break;
    }
    case TILE.MICROWAVE: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(x + 2 * F, 4 * F, 12 * F, 8 * F);
      ctx.fillStyle = '#222222';
      ctx.fillRect(x + 3 * F, 5 * F, 7 * F, 6 * F);
      ctx.fillStyle = '#335544';
      ctx.fillRect(x + 4 * F, 6 * F, 5 * F, 4 * F);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(x + 11 * F, 6 * F, F, F);
      ctx.fillRect(x + 11 * F, 8 * F, F, F);
      ctx.fillRect(x + 11 * F, 10 * F, F, F);
      break;
    }
    case TILE.SINK: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(x + 2 * F, 4 * F, 12 * F, 10 * F);
      ctx.fillStyle = '#8899aa';
      ctx.fillRect(x + 3 * F, 5 * F, 10 * F, 7 * F);
      ctx.fillStyle = '#5588cc';
      ctx.fillRect(x + 5 * F, 7 * F, 6 * F, 4 * F);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(x + 7 * F, 2 * F, 2 * F, 3 * F);
      ctx.fillRect(x + 6 * F, 2 * F, 4 * F, F);
      break;
    }
    case TILE.VENDING_MACHINE: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#cc3344';
      ctx.fillRect(x + 2 * F, 0, 12 * F, 15 * F);
      ctx.fillStyle = '#222233';
      ctx.fillRect(x + 4 * F, 2 * F, 8 * F, 7 * F);
      ctx.fillStyle = '#44cc66';
      ctx.fillRect(x + 5 * F, 3 * F, 2 * F, 2 * F);
      ctx.fillStyle = '#4488dd';
      ctx.fillRect(x + 8 * F, 3 * F, 2 * F, 2 * F);
      ctx.fillStyle = '#ddaa33';
      ctx.fillRect(x + 5 * F, 6 * F, 2 * F, 2 * F);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(x + 5 * F, 10 * F, 6 * F, 3 * F);
      break;
    }
    case TILE.WATER_COOLER: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#aaaabb';
      ctx.fillRect(x + 5 * F, 6 * F, 6 * F, 9 * F);
      ctx.fillStyle = '#5588cc';
      ctx.fillRect(x + 6 * F, F, 4 * F, 6 * F);
      ctx.fillStyle = '#4477bb';
      ctx.fillRect(x + 7 * F, 0, 2 * F, 2 * F);
      ctx.fillStyle = '#dd4444';
      ctx.fillRect(x + 5 * F, 9 * F, F, F);
      ctx.fillStyle = '#4488cc';
      ctx.fillRect(x + 10 * F, 9 * F, F, F);
      break;
    }
    case TILE.PAINTING: {
      ctx.fillStyle = '#3a3a5e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(x + 3 * F, 3 * F, 10 * F, 8 * F);
      ctx.fillStyle = '#88bbdd';
      ctx.fillRect(x + 4 * F, 4 * F, 8 * F, 3 * F);
      ctx.fillStyle = '#44aa44';
      ctx.fillRect(x + 4 * F, 7 * F, 8 * F, 3 * F);
      ctx.fillStyle = '#ddcc44';
      ctx.fillRect(x + 9 * F, 5 * F, 2 * F, 2 * F);
      break;
    }
    case TILE.FLOOR_LAMP: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(x + 7 * F, 5 * F, 2 * F, 10 * F);
      ctx.fillRect(x + 6 * F, 14 * F, 4 * F, F);
      ctx.fillStyle = '#ddcc88';
      ctx.fillRect(x + 4 * F, 2 * F, 8 * F, 4 * F);
      ctx.fillStyle = '#ffee99';
      ctx.fillRect(x + 5 * F, 3 * F, 6 * F, 2 * F);
      break;
    }
    case TILE.WALL_CLOCK: {
      ctx.fillStyle = '#3a3a5e';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#dddddd';
      ctx.fillRect(x + 4 * F, 3 * F, 8 * F, 8 * F);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 5 * F, 4 * F, 6 * F, 6 * F);
      ctx.fillStyle = '#222222';
      ctx.fillRect(x + 7.5 * F, 4.5 * F, F, 3 * F);
      ctx.fillRect(x + 7.5 * F, 6.5 * F, 2.5 * F, F);
      ctx.fillStyle = '#dd3333';
      ctx.fillRect(x + 8 * F, 7 * F, F, F);
      break;
    }
    case TILE.TROPHY: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#ddaa33';
      ctx.fillRect(x + 5 * F, 3 * F, 6 * F, 5 * F);
      ctx.fillStyle = '#ccaa22';
      ctx.fillRect(x + 4 * F, 3 * F, F, 3 * F);
      ctx.fillRect(x + 11 * F, 3 * F, F, 3 * F);
      ctx.fillStyle = '#bb9922';
      ctx.fillRect(x + 7 * F, 8 * F, 2 * F, 3 * F);
      ctx.fillRect(x + 5 * F, 11 * F, 6 * F, 2 * F);
      break;
    }
    case TILE.AQUARIUM: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a6a7a';
      ctx.fillRect(x + F, 2 * F, 14 * F, 12 * F);
      ctx.fillStyle = '#3388bb';
      ctx.fillRect(x + 2 * F, 3 * F, 12 * F, 10 * F);
      ctx.fillStyle = '#44aadd';
      ctx.fillRect(x + 2 * F, 3 * F, 12 * F, 2 * F);
      ctx.fillStyle = '#ff8833';
      ctx.fillRect(x + 5 * F, 7 * F, 2 * F, F);
      ctx.fillStyle = '#ffaa44';
      ctx.fillRect(x + 9 * F, 9 * F, 2 * F, F);
      ctx.fillStyle = '#33aa55';
      ctx.fillRect(x + 11 * F, 8 * F, F, 4 * F);
      ctx.fillRect(x + 4 * F, 10 * F, F, 3 * F);
      break;
    }
    case TILE.WOOD_FLOOR: {
      ctx.fillStyle = '#b08858';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#a07848';
      ctx.fillRect(x, 0, S, F);
      ctx.fillRect(x, 4 * F, S, F);
      ctx.fillRect(x, 8 * F, S, F);
      ctx.fillRect(x, 12 * F, S, F);
      ctx.fillStyle = '#987040';
      ctx.fillRect(x + 5 * F, 0, F, 4 * F);
      ctx.fillRect(x + 10 * F, 4 * F, F, 4 * F);
      ctx.fillRect(x + 3 * F, 8 * F, F, 4 * F);
      ctx.fillRect(x + 12 * F, 12 * F, F, 4 * F);
      break;
    }
    case TILE.TILE_FLOOR: {
      ctx.fillStyle = '#d8d0c8';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#c8c0b8';
      ctx.fillRect(x, 0, S, F);
      ctx.fillRect(x, 0, F, S);
      ctx.fillRect(x, 8 * F, S, F);
      ctx.fillRect(x + 8 * F, 0, F, S);
      break;
    }
    case TILE.GRASS: {
      ctx.fillStyle = '#4a8a3a';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#3a7a2a';
      ctx.fillRect(x + 2 * F, 3 * F, F, 2 * F);
      ctx.fillRect(x + 8 * F, F, F, 2 * F);
      ctx.fillRect(x + 5 * F, 9 * F, F, 2 * F);
      ctx.fillRect(x + 12 * F, 6 * F, F, 2 * F);
      ctx.fillRect(x + 10 * F, 12 * F, F, 2 * F);
      ctx.fillStyle = '#5a9a4a';
      ctx.fillRect(x + 4 * F, 6 * F, F, F);
      ctx.fillRect(x + 13 * F, 2 * F, F, F);
      ctx.fillRect(x + F, 11 * F, F, F);
      break;
    }
    case TILE.SIDEWALK: {
      ctx.fillStyle = '#b0aaaa';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#a09a9a';
      ctx.fillRect(x, 0, S, F);
      ctx.fillRect(x, 0, F, S);
      ctx.fillRect(x + 8 * F, 0, F, S);
      ctx.fillRect(x, 8 * F, S, F);
      break;
    }
    case TILE.BENCH: {
      drawTile(ctx, x, TILE.GRASS);
      ctx.fillStyle = '#8b6b3e';
      ctx.fillRect(x + 2 * F, 6 * F, 12 * F, 3 * F);
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(x + 2 * F, 4 * F, 12 * F, 2 * F);
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(x + 3 * F, 9 * F, 2 * F, 4 * F);
      ctx.fillRect(x + 11 * F, 9 * F, 2 * F, 4 * F);
      break;
    }
    case TILE.PLANTER: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(x + 2 * F, 8 * F, 12 * F, 6 * F);
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(x + 2 * F, 8 * F, 12 * F, F);
      ctx.fillStyle = '#3a8a3a';
      ctx.fillRect(x + 3 * F, 3 * F, 10 * F, 6 * F);
      ctx.fillStyle = '#4aaa4a';
      ctx.fillRect(x + 4 * F, 2 * F, 4 * F, 4 * F);
      ctx.fillStyle = '#5abb5a';
      ctx.fillRect(x + 9 * F, F, 3 * F, 4 * F);
      break;
    }
    case TILE.FOUNTAIN: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#8899aa';
      ctx.fillRect(x + 2 * F, 3 * F, 12 * F, 11 * F);
      ctx.fillStyle = '#4488cc';
      ctx.fillRect(x + 3 * F, 4 * F, 10 * F, 9 * F);
      ctx.fillStyle = '#55aadd';
      ctx.fillRect(x + 4 * F, 5 * F, 8 * F, 7 * F);
      ctx.fillStyle = '#7799aa';
      ctx.fillRect(x + 7 * F, 5 * F, 2 * F, 4 * F);
      ctx.fillStyle = '#66bbee';
      ctx.fillRect(x + 6 * F, 5 * F, 4 * F, 2 * F);
      break;
    }
    case TILE.PARKING: {
      ctx.fillStyle = '#4a4a50';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(x, 0, F, S);
      ctx.fillRect(x + S - F, 0, F, S);
      ctx.fillStyle = '#dddddd';
      ctx.fillRect(x + 6 * F, 5 * F, 4 * F, 6 * F);
      ctx.fillStyle = '#4a4a50';
      ctx.fillRect(x + 7 * F, 6 * F, 2 * F, 4 * F);
      break;
    }
    case TILE.SIGN: {
      drawTile(ctx, x, TILE.FLOOR);
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(x + 7 * F, 7 * F, 2 * F, 8 * F);
      ctx.fillStyle = '#3366aa';
      ctx.fillRect(x + 3 * F, 2 * F, 10 * F, 6 * F);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 5 * F, 4 * F, F, 2 * F);
      ctx.fillRect(x + 7 * F, 3 * F, 3 * F, F);
      ctx.fillRect(x + 7 * F, 5 * F, 3 * F, F);
      ctx.fillRect(x + 7 * F, 7 * F, 3 * F, F);
      break;
    }
    default: {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(x, 0, S, S);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 2 * F, 2 * F, S - 4 * F, S - 4 * F);
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(x + 4 * F, 4 * F, S - 8 * F, S - 8 * F);
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
  const F = TILE_SIZE / 16;
  const eye = '#1a1a2e';
  const skin = '#f0c890';
  const pants = '#384058';
  const shoe = '#28282e';

  const p = (cx: number, cy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + cx * F, y + cy * F, w * F, h * F);
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

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  accessory: AccessoryType,
  dir: 'down' | 'left' | 'right' | 'up',
): void {
  const F = TILE_SIZE / 16;
  const p = (cx: number, cy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + cx * F, y + cy * F, w * F, h * F);
  };

  switch (accessory) {
    case 'glasses':
      if (dir !== 'up') {
        p(5, 3, 2, 2, '#5588bb');
        p(9, 3, 2, 2, '#5588bb');
        p(7, 3.5, 2, 1, '#5588bb');
        p(6, 4, 1, 1, '#aaddff');
        p(9, 4, 1, 1, '#aaddff');
      }
      break;

    case 'beret':
      if (dir === 'up') {
        p(4, -1, 8, 2, '#cc3355');
        p(5, -2, 4, 1, '#cc3355');
      } else {
        p(4, -1, 8, 2, '#cc3355');
        p(5, -2, 4, 1, '#cc3355');
        p(11, -1, 1, 1, '#aa2244');
      }
      break;

    case 'headphones':
      if (dir !== 'up') {
        p(4, 0, 1, 3, '#444444');
        p(11, 0, 1, 3, '#444444');
        p(4, -1, 8, 1, '#555555');
        p(4, 2, 1, 2, '#666666');
        p(11, 2, 1, 2, '#666666');
      } else {
        p(4, -1, 8, 1, '#555555');
      }
      break;

    case 'book':
      if (dir === 'left') {
        p(2, 7, 2, 3, '#884422');
        p(2, 7, 2, 1, '#ffeecc');
      } else if (dir === 'right') {
        p(12, 7, 2, 3, '#884422');
        p(12, 7, 2, 1, '#ffeecc');
      } else if (dir === 'down') {
        p(12, 7, 2, 3, '#884422');
        p(12, 7, 2, 1, '#ffeecc');
      }
      break;

    case '3d_glasses':
      if (dir !== 'up') {
        p(5, 3, 2, 2, '#dd3333');
        p(9, 3, 2, 2, '#3333dd');
        p(7, 3.5, 2, 1, '#444444');
      }
      break;
  }
}
