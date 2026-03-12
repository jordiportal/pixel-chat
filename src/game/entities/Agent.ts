import Phaser from 'phaser';
import type { AgentDef } from '../map/OfficeMap';
import { TILE_SIZE, WALKABLE } from '../map/OfficeMap';
import { findPath, getDirection, type GridPos } from '../pathfinding';
import { Bubble } from '../ui/Bubble';

export type AgentState = 'idle' | 'walking' | 'working' | 'thinking';

export class Agent {
  readonly def: AgentDef;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  tileX: number;
  tileY: number;
  state: AgentState = 'idle';
  active = false;

  private scene: Phaser.Scene;
  private bubble: Bubble | null = null;
  private walkPromise: Promise<void> | null = null;
  private walkCancel = false;
  private collisionGrid: number[][] = [];

  constructor(scene: Phaser.Scene, def: AgentDef, collisionGrid: number[][]) {
    this.scene = scene;
    this.def = def;
    this.tileX = def.homeX;
    this.tileY = def.homeY;
    this.collisionGrid = collisionGrid;

    const px = def.homeX * TILE_SIZE + TILE_SIZE / 2;
    const py = def.homeY * TILE_SIZE + TILE_SIZE / 2;

    this.sprite = scene.add.sprite(px, py, `agent-${def.id}`, 0);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(10);

    this.nameTag = scene.add.text(px, py - 12, def.name, {
      fontSize: '7px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { left: 2, right: 2, top: 1, bottom: 1 },
    });
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(11);

    this.setActive(def.id === 'brain');
  }

  setActive(val: boolean): void {
    this.active = val;
    this.sprite.setAlpha(val ? 1 : 0.35);
    this.nameTag.setAlpha(val ? 1 : 0.35);
  }

  async walkTo(tx: number, ty: number): Promise<void> {
    this.walkCancel = false;
    const path = findPath(
      this.tileX, this.tileY, tx, ty,
      (x, y) => {
        const row = this.collisionGrid[y];
        return row !== undefined && WALKABLE.has(row[x]);
      },
    );
    if (path.length < 2) return;

    this.state = 'walking';

    for (let i = 1; i < path.length; i++) {
      if (this.walkCancel) break;
      const prev = path[i - 1];
      const next = path[i];
      const dir = getDirection(prev, next);
      this.playWalk(dir);

      await this.tweenTo(next.x, next.y);
      this.tileX = next.x;
      this.tileY = next.y;
    }

    this.state = 'idle';
    this.playIdle();
  }

  async goHome(): Promise<void> {
    await this.walkTo(this.def.homeX, this.def.homeY);
  }

  showThinking(text?: string): void {
    this.clearBubble();
    this.state = 'thinking';
    const display = text
      ? (text.length > 30 ? text.slice(0, 28) + '..' : text)
      : '...';
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - 18, display, 'thought');
  }

  showSpeech(text: string): void {
    this.clearBubble();
    const display = text.length > 40 ? text.slice(0, 38) + '..' : text;
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - 18, display, 'speech');
  }

  startWorking(): void {
    this.state = 'working';
    this.clearBubble();
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - 18, '⚡', 'speech', 0);
  }

  stopAction(): void {
    this.walkCancel = true;
    this.clearBubble();
    this.state = 'idle';
    this.playIdle();
  }

  update(): void {
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - 12);
    if (this.bubble && !this.bubble.destroyed) {
      this.bubble.setPosition(this.sprite.x, this.sprite.y - 18);
    }
  }

  private clearBubble(): void {
    if (this.bubble && !this.bubble.destroyed) {
      this.bubble.destroy();
    }
    this.bubble = null;
  }

  private tweenTo(tx: number, ty: number): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.sprite,
        x: tx * TILE_SIZE + TILE_SIZE / 2,
        y: ty * TILE_SIZE + TILE_SIZE / 2,
        duration: 160,
        ease: 'Linear',
        onComplete: () => resolve(),
      });
    });
  }

  private playWalk(dir: string): void {
    const key = `${this.def.id}-walk-${dir}`;
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.play(key, true);
    }
  }

  private playIdle(dir = 'down'): void {
    this.sprite.play(`${this.def.id}-idle-${dir}`, true);
  }
}
