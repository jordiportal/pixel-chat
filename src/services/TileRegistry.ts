import { db, type TileDefRow } from '../db/Database';

const BUILTIN_MAX_ID = 46;

export interface TileDef {
  id: number;
  name: string;
  charCode: string;
  walkable: boolean;
  interactable: boolean;
  spriteData: string | null;
}

function rowToDef(row: TileDefRow): TileDef {
  return {
    id: row.id,
    name: row.name,
    charCode: row.char_code,
    walkable: row.walkable === 1,
    interactable: row.interactable === 1,
    spriteData: row.sprite_data,
  };
}

class TileRegistryClass {
  private defs: TileDef[] = [];
  private byId = new Map<number, TileDef>();
  private sprites = new Map<number, HTMLImageElement>();
  private _walkable = new Set<number>();
  private _interactable = new Set<number>();

  get count(): number { return this.defs.length; }
  get walkableSet(): Set<number> { return this._walkable; }
  get interactableSet(): Set<number> { return this._interactable; }

  async load(): Promise<void> {
    await db.seedBuiltinTiles();

    const rows = db.getAllTileDefs();
    this.defs = rows.map(rowToDef);
    this.byId.clear();
    this._walkable.clear();
    this._interactable.clear();

    for (const d of this.defs) {
      this.byId.set(d.id, d);
      if (d.walkable) this._walkable.add(d.id);
      if (d.interactable) this._interactable.add(d.id);
    }

    await this.preloadSprites();
    console.log(`[TileRegistry] Loaded ${this.defs.length} tile definitions (${this.sprites.size} custom sprites)`);
  }

  private async preloadSprites(): Promise<void> {
    this.sprites.clear();
    const tasks = this.defs
      .filter(d => d.spriteData)
      .map(async d => {
        try {
          const img = await loadImage(d.spriteData!);
          this.sprites.set(d.id, img);
        } catch (err) {
          console.warn(`[TileRegistry] Failed to load sprite for tile ${d.id}:`, err);
        }
      });
    await Promise.all(tasks);
  }

  getAll(): TileDef[] { return [...this.defs]; }

  getDef(id: number): TileDef | undefined { return this.byId.get(id); }

  getName(id: number): string {
    return this.byId.get(id)?.name ?? `Tile ${id}`;
  }

  getCharCode(id: number): string {
    return this.byId.get(id)?.charCode ?? '?';
  }

  getSpriteImage(id: number): HTMLImageElement | null {
    return this.sprites.get(id) ?? null;
  }

  isBuiltin(id: number): boolean {
    return id <= BUILTIN_MAX_ID;
  }

  getCharToTile(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const d of this.defs) map[d.charCode] = d.id;
    return map;
  }

  getTileToChar(): Record<number, string> {
    const map: Record<number, string> = {};
    for (const d of this.defs) map[d.id] = d.charCode;
    return map;
  }

  getNames(): Record<number, string> {
    const map: Record<number, string> = {};
    for (const d of this.defs) map[d.id] = d.name;
    return map;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image`));
    img.src = src;
  });
}

export const tileRegistry = new TileRegistryClass();
