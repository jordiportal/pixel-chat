import Phaser from 'phaser';
import { TILE_SIZE, TILE } from '../map/OfficeMap';

interface ActiveTile {
  x: number;
  y: number;
  tileId: number;
  overlay: Phaser.GameObjects.Graphics;
  timer: Phaser.Time.TimerEvent;
  flashState: boolean;
}

const FLASH_COLORS: Record<number, { on: number; off: number }> = {
  [TILE.MONITOR]:    { on: 0x60ee80, off: 0x40cc60 },
  [TILE.SERVER]:     { on: 0x60ff80, off: 0x40dd60 },
  [TILE.LAPTOP]:     { on: 0x4466dd, off: 0x2244aa },
  [TILE.PRINTER]:    { on: 0x66cc66, off: 0x44aa44 },
  [TILE.TV_SCREEN]:  { on: 0x4477ee, off: 0x2255bb },
  [TILE.ROUTER]:     { on: 0x60ff80, off: 0x40dd60 },
  [TILE.WHITEBOARD]: { on: 0xf0f0ff, off: 0xe0e0e8 },
};

export class TileEffects {
  private scene: Phaser.Scene;
  private mapData: number[][];
  private activeTiles: ActiveTile[] = [];

  constructor(scene: Phaser.Scene, mapData: number[][]) {
    this.scene = scene;
    this.mapData = mapData;
  }

  activate(tileX: number, tileY: number): void {
    const neighbors = this.findInteractableNeighbors(tileX, tileY);
    for (const n of neighbors) {
      if (this.activeTiles.some(t => t.x === n.x && t.y === n.y)) continue;
      this.startFlash(n.x, n.y, n.tileId);
    }
  }

  deactivateAll(): void {
    for (const tile of this.activeTiles) {
      tile.timer.remove();
      this.scene.tweens.add({
        targets: tile.overlay,
        alpha: 0,
        duration: 300,
        onComplete: () => tile.overlay.destroy(),
      });
    }
    this.activeTiles = [];
  }

  private findInteractableNeighbors(cx: number, cy: number): Array<{ x: number; y: number; tileId: number }> {
    const results: Array<{ x: number; y: number; tileId: number }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (ny < 0 || ny >= this.mapData.length) continue;
        if (nx < 0 || nx >= (this.mapData[0]?.length ?? 0)) continue;
        const tileId = this.mapData[ny][nx];
        if (tileId in FLASH_COLORS) {
          results.push({ x: nx, y: ny, tileId });
        }
      }
    }
    return results;
  }

  private startFlash(tx: number, ty: number, tileId: number): void {
    const colors = FLASH_COLORS[tileId];
    if (!colors) return;

    const overlay = this.scene.add.graphics();
    overlay.setDepth(2);
    overlay.setAlpha(0.4);

    const active: ActiveTile = {
      x: tx, y: ty, tileId, overlay,
      flashState: false,
      timer: this.scene.time.addEvent({
        delay: tileId === TILE.SERVER || tileId === TILE.ROUTER ? 200 : 500,
        loop: true,
        callback: () => {
          active.flashState = !active.flashState;
          overlay.clear();
          overlay.fillStyle(active.flashState ? colors.on : colors.off, 0.35);
          overlay.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        },
      }),
    };

    overlay.fillStyle(colors.off, 0.35);
    overlay.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.activeTiles.push(active);
  }
}
