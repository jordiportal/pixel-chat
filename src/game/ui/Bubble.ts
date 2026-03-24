import Phaser from 'phaser';
import { TILE_SIZE } from '../map/OfficeMap';

export class Bubble extends Phaser.GameObjects.Container {
  destroyed = false;
  private timer: Phaser.Time.TimerEvent | null = null;

  /**
   * @param ttl auto-dismiss in ms. 0 = persist until manually destroyed.
   */
  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    text: string,
    type: 'thought' | 'speech',
    ttl = 5000,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(50);

    const isThought = type === 'thought';
    const fontSize = Math.round(TILE_SIZE * 0.5);
    const maxWidth = TILE_SIZE * 7;

    const txt = scene.add.text(0, 0, text, {
      fontSize: `${fontSize}px`,
      fontFamily: 'monospace',
      color: isThought ? '#6a6aaa' : '#1a1a2e',
      fontStyle: isThought ? 'italic' : 'normal',
      wordWrap: { width: maxWidth },
      align: 'left',
      lineSpacing: 2,
    });
    txt.setOrigin(0.5, 0.5);

    const padX = 10;
    const padY = 7;
    const w = Math.max(txt.width + padX * 2, TILE_SIZE * 2);
    const h = txt.height + padY * 2;
    const r = isThought ? 8 : 5;

    const bg = scene.add.graphics();

    if (isThought) {
      bg.fillStyle(0xddddf0, 0.88);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      bg.lineStyle(1.5, 0x8888bb, 0.5);
      const dashLen = 4;
      const gap = 3;
      const x0 = -w / 2;
      const y0 = -h / 2;
      for (let dx = 0; dx < w; dx += dashLen + gap) {
        bg.strokeRect(x0 + dx, y0, Math.min(dashLen, w - dx), 0);
        bg.strokeRect(x0 + dx, y0 + h, Math.min(dashLen, w - dx), 0);
      }
      for (let dy = 0; dy < h; dy += dashLen + gap) {
        bg.strokeRect(x0, y0 + dy, 0, Math.min(dashLen, h - dy));
        bg.strokeRect(x0 + w, y0 + dy, 0, Math.min(dashLen, h - dy));
      }

      bg.fillStyle(0xddddf0, 0.8);
      bg.fillCircle(3, h / 2 + 4, 3.5);
      bg.fillCircle(7, h / 2 + 10, 2.5);
      bg.fillCircle(10, h / 2 + 14, 1.5);
    } else {
      bg.fillStyle(0xffffff, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      bg.lineStyle(1.5, 0x3a3a5e, 0.7);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

      bg.fillStyle(0xffffff, 0.95);
      bg.fillTriangle(-3, h / 2, 3, h / 2, 0, h / 2 + 6);
      bg.lineStyle(1.5, 0x3a3a5e, 0.7);
      bg.lineBetween(-3, h / 2, 0, h / 2 + 6);
      bg.lineBetween(3, h / 2, 0, h / 2 + 6);
    }

    this.add([bg, txt]);

    if (isThought) {
      scene.tweens.add({
        targets: this,
        alpha: { from: 0.7, to: 1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    if (ttl > 0) {
      this.timer = scene.time.delayedCall(ttl, () => this.fadeOut());
    }
  }

  private fadeOut(): void {
    if (this.destroyed) return;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 400,
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.timer?.remove();
    super.destroy(true);
  }
}
