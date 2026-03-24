import Phaser from 'phaser';
import type { AgentDef } from '../map/OfficeMap';
import { TILE_SIZE, getWalkableSet } from '../map/OfficeMap';
import { findPath, getDirection, type GridPos } from '../pathfinding';
import { Bubble } from '../ui/Bubble';
import { getToolIcon } from '../constants/ToolVisuals';

export type AgentState = 'idle' | 'walking' | 'working' | 'thinking';

export class Agent {
  readonly def: AgentDef;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  tileX: number;
  tileY: number;
  state: AgentState = 'idle';
  active = false;
  currentActionType = '';

  private scene: Phaser.Scene;
  private bubble: Bubble | null = null;
  private walkPromise: Promise<void> | null = null;
  private walkCancel = false;
  private collisionGrid: number[][] = [];
  private progressBar: Phaser.GameObjects.Graphics | null = null;
  private progressBg: Phaser.GameObjects.Graphics | null = null;
  private progressValue = 0;
  private progressMax = 0;

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

    this.nameTag = scene.add.text(px, py - TILE_SIZE * 0.75, def.name, {
      fontSize: `${Math.round(TILE_SIZE * 0.44)}px`,
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { left: 2, right: 2, top: 1, bottom: 1 },
    });
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(11);

    this.setActive(false);
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
        return row !== undefined && getWalkableSet().has(row[x]);
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
      ? (text.length > 80 ? text.slice(0, 77) + '...' : text)
      : '...';
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - TILE_SIZE * 1.25, display, 'thought');
  }

  showSpeech(text: string): void {
    this.clearBubble();
    const display = text.length > 100 ? text.slice(0, 97) + '...' : text;
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - TILE_SIZE * 1.25, display, 'speech');
  }

  startWorking(actionType?: string): void {
    this.state = 'working';
    this.currentActionType = actionType ?? '';
    this.clearBubble();
    const icon = getToolIcon(actionType ?? '');
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - TILE_SIZE * 1.25, icon, 'speech', 0);
  }

  stopAction(): void {
    this.walkCancel = true;
    this.clearBubble();
    this.hideProgress();
    this.currentActionType = '';
    this.state = 'idle';
    this.playIdle();
  }

  /* ─── Progress bar ─── */

  showProgress(current: number, max: number): void {
    this.progressValue = current;
    this.progressMax = max;
    this.drawProgress();
  }

  hideProgress(): void {
    this.progressValue = 0;
    this.progressMax = 0;
    this.progressBar?.destroy();
    this.progressBg?.destroy();
    this.progressBar = null;
    this.progressBg = null;
  }

  private drawProgress(): void {
    if (this.progressMax <= 0) return;
    const barW = TILE_SIZE * 0.9;
    const barH = 3;
    const yOff = this.sprite.y - TILE_SIZE * 0.55;
    const xOff = this.sprite.x - barW / 2;

    if (!this.progressBg) {
      this.progressBg = this.scene.add.graphics();
      this.progressBg.setDepth(12);
    }
    if (!this.progressBar) {
      this.progressBar = this.scene.add.graphics();
      this.progressBar.setDepth(13);
    }

    this.progressBg.clear();
    this.progressBg.fillStyle(0x000000, 0.5);
    this.progressBg.fillRoundedRect(xOff, yOff, barW, barH, 1);

    const pct = Math.min(this.progressValue / this.progressMax, 1);
    const r = Math.round(255 * (1 - pct));
    const g = Math.round(200 * pct + 55);
    const color = (r << 16) | (g << 8) | 0x20;

    this.progressBar.clear();
    this.progressBar.fillStyle(color, 0.9);
    this.progressBar.fillRoundedRect(xOff, yOff, barW * pct, barH, 1);
  }

  /* ─── Emotions ─── */

  celebrate(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - TILE_SIZE * 0.4,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.sprite,
          y: this.sprite.y - TILE_SIZE * 0.2,
          duration: 120,
          yoyo: true,
          ease: 'Quad.easeOut',
        });
      },
    });
  }

  shakeError(): void {
    const origX = this.sprite.x;
    this.scene.tweens.add({
      targets: this.sprite,
      x: origX + 3,
      duration: 40,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.sprite.x = origX; },
    });
    this.clearBubble();
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - TILE_SIZE * 1.25, '❌', 'speech', 2500);
  }

  wave(): void {
    this.clearBubble();
    this.bubble = new Bubble(this.scene, this.sprite.x, this.sprite.y - TILE_SIZE * 1.25, '👋', 'speech', 2000);
  }

  update(): void {
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE * 0.75);
    if (this.bubble && !this.bubble.destroyed) {
      this.bubble.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE * 1.25);
    }
    if (this.progressBar || this.progressBg) {
      this.drawProgress();
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

  destroy(): void {
    this.clearBubble();
    this.hideProgress();
    this.nameTag.destroy();
    this.sprite.destroy();
  }
}
