import Phaser from 'phaser';
import {
  parseMapData, defaultMapGrid, getZones,
  TILE_SIZE, MAP_COLS, MAP_ROWS, TILE, getTileCount,
} from '../game/map/OfficeMap';
import { db } from '../db/Database';
import { eventBus } from '../events/EventBus';
import { drawTile } from '../game/scenes/PreloadScene';
import { tileRegistry } from '../services/TileRegistry';

export class EditorScene extends Phaser.Scene {
  private mapData: number[][] = [];
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private zoneGraphics!: Phaser.GameObjects.Graphics;
  private hoverRect!: Phaser.GameObjects.Graphics;
  private agentMarkers: Phaser.GameObjects.Graphics[] = [];

  private selectedTile: number = TILE.FLOOR;
  private isPainting = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor() {
    super('EditorScene');
  }

  create(): void {
    this.mapData = parseMapData();
    this.buildTileset();
    this.createTilemap();
    this.drawGrid();
    this.drawZones();
    this.drawAgentMarkers();
    this.setupInput();
    this.setupCamera();

    eventBus.on('editor:selectTile', (tileIdx: number) => {
      this.selectedTile = tileIdx;
    });

    eventBus.on('editor:zonesChanged', () => {
      this.drawZones();
    });

    eventBus.on('editor:agentsChanged', () => {
      this.drawAgentMarkers();
    });

    eventBus.on('editor:resetMap', () => {
      this.mapData = defaultMapGrid();
      this.rebuildLayer();
      this.saveNow();
    });

    eventBus.on('editor:importMap', (grid: number[][]) => {
      this.mapData = grid;
      this.rebuildLayer();
      this.saveNow();
    });

    eventBus.on('editor:requestSave', () => {
      this.saveNow();
    });

    eventBus.on('editor:tilesChanged', async () => {
      await tileRegistry.load();
      this.buildTileset();
      this.rebuildTilemap();
    });
  }

  private rebuildTilemap(): void {
    if (this.layer) this.layer.tilemap.destroy();
    this.createTilemap();
    this.rebuildLayer();
  }

  private buildTileset(): void {
    const S = TILE_SIZE;
    const count = getTileCount();
    if (this.textures.exists('tiles')) this.textures.remove('tiles');
    const tex = this.textures.createCanvas('tiles', count * S, S);
    const ctx = tex!.getContext();
    for (let i = 0; i < count; i++) {
      drawTile(ctx, i * S, i);
    }
    tex!.refresh();
  }

  private createTilemap(): void {
    const map = this.make.tilemap({
      data: this.mapData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) return;

    this.layer = map.createLayer(0, tileset, 0, 0)!;
    this.layer.setDepth(0);
  }

  private rebuildLayer(): void {
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        this.layer.putTileAt(this.mapData[y][x], x, y);
      }
    }
  }

  private drawGrid(): void {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.lineStyle(1, 0xffffff, 0.08);
    this.gridGraphics.setDepth(5);

    for (let x = 0; x <= MAP_COLS; x++) {
      this.gridGraphics.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, MAP_ROWS * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_ROWS; y++) {
      this.gridGraphics.lineBetween(0, y * TILE_SIZE, MAP_COLS * TILE_SIZE, y * TILE_SIZE);
    }
  }

  drawZones(): void {
    if (this.zoneGraphics) this.zoneGraphics.destroy();
    this.zoneGraphics = this.add.graphics();
    this.zoneGraphics.setDepth(3);

    const zones = getZones();
    const colors = [0xe94560, 0x4488cc, 0x44aa44, 0xccaa44, 0xaa44cc];
    let ci = 0;

    for (const z of Object.values(zones)) {
      const color = colors[ci++ % colors.length];
      const b = z.bounds;
      this.zoneGraphics.lineStyle(1, color, 0.5);
      this.zoneGraphics.strokeRect(
        b.x * TILE_SIZE, b.y * TILE_SIZE,
        b.w * TILE_SIZE, b.h * TILE_SIZE,
      );
      this.zoneGraphics.fillStyle(color, 0.06);
      this.zoneGraphics.fillRect(
        b.x * TILE_SIZE, b.y * TILE_SIZE,
        b.w * TILE_SIZE, b.h * TILE_SIZE,
      );

      this.zoneGraphics.fillStyle(color, 0.6);
      this.zoneGraphics.fillCircle(
        z.poi.x * TILE_SIZE + TILE_SIZE / 2,
        z.poi.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE * 0.25,
      );

      const label = this.add.text(
        (b.x + 0.5) * TILE_SIZE,
        (b.y + 0.3) * TILE_SIZE,
        z.label,
        { fontSize: `${Math.round(TILE_SIZE * 0.44)}px`, fontFamily: 'monospace', color: `#${color.toString(16).padStart(6, '0')}` },
      );
      label.setDepth(6);
    }
  }

  drawAgentMarkers(): void {
    for (const m of this.agentMarkers) m.destroy();
    this.agentMarkers = [];

    const agents = db.getAllAgents();
    for (const a of agents) {
      const g = this.add.graphics();
      g.setDepth(7);
      const cx = a.home_x * TILE_SIZE + TILE_SIZE / 2;
      const cy = a.home_y * TILE_SIZE + TILE_SIZE / 2;
      const color = parseInt(a.body_color.replace('#', ''), 16);
      const r = TILE_SIZE * 0.25;
      g.fillStyle(color, 0.8);
      g.fillCircle(cx, cy, r);
      g.lineStyle(1, 0xffffff, 0.5);
      g.strokeCircle(cx, cy, r);

      const label = this.add.text(cx + r + 1, cy - r, a.name.slice(0, 8), {
        fontSize: `${Math.round(TILE_SIZE * 0.3)}px`, fontFamily: 'monospace', color: '#ffffff',
      });
      label.setDepth(7);
      this.agentMarkers.push(g);
    }
  }

  private setupInput(): void {
    this.hoverRect = this.add.graphics();
    this.hoverRect.setDepth(10);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const wx = pointer.worldX;
      const wy = pointer.worldY;
      const tx = Math.floor(wx / TILE_SIZE);
      const ty = Math.floor(wy / TILE_SIZE);

      this.hoverRect.clear();
      if (tx >= 0 && tx < MAP_COLS && ty >= 0 && ty < MAP_ROWS) {
        this.hoverRect.lineStyle(2, 0xe94560, 0.8);
        this.hoverRect.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        eventBus.emit('editor:hover', { x: tx, y: ty, tile: this.mapData[ty][tx] });

        if (this.isPainting) {
          this.paintTile(tx, ty);
        }
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      this.isPainting = true;
      const tx = Math.floor(pointer.worldX / TILE_SIZE);
      const ty = Math.floor(pointer.worldY / TILE_SIZE);
      if (tx >= 0 && tx < MAP_COLS && ty >= 0 && ty < MAP_ROWS) {
        this.paintTile(tx, ty);
      }
    });

    this.input.on('pointerup', () => {
      this.isPainting = false;
    });

    this.input.on('pointerupoutside', () => {
      this.isPainting = false;
    });
  }

  private paintTile(tx: number, ty: number): void {
    if (this.mapData[ty][tx] === this.selectedTile) return;
    this.mapData[ty][tx] = this.selectedTile;
    this.layer.putTileAt(this.selectedTile, tx, ty);
    if (!this.dirty) {
      this.dirty = true;
      eventBus.emit('editor:dirty');
    }
    this.scheduleAutoSave();
  }

  private scheduleAutoSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 1500);
  }

  saveNow(): void {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    db.saveMapGrid(this.mapData, MAP_COLS, MAP_ROWS);
    this.dirty = false;
    eventBus.emit('editor:saved');
  }

  private setupCamera(): void {
    const worldW = MAP_COLS * TILE_SIZE;
    const worldH = MAP_ROWS * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.centerOn(worldW / 2, worldH / 2);

    let dragStartX = 0;
    let dragStartY = 0;
    let camStartX = 0;
    let camStartY = 0;
    let isDragging = false;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        isDragging = true;
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        camStartX = this.cameras.main.scrollX;
        camStartY = this.cameras.main.scrollY;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (isDragging) {
        const dx = dragStartX - pointer.x;
        const dy = dragStartY - pointer.y;
        this.cameras.main.setScroll(camStartX + dx, camStartY + dy);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        isDragging = false;
      }
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom + (deltaY > 0 ? -0.1 : 0.1), 0.25, 3);
      cam.setZoom(newZoom);
    });

    this.input.mouse?.disableContextMenu();
  }

  getMapData(): number[][] {
    return this.mapData;
  }
}
