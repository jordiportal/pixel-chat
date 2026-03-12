import Phaser from 'phaser';

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
    ttl = 4000,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(50);

    const txt = scene.add.text(0, 0, text, {
      fontSize: '6px',
      fontFamily: 'monospace',
      color: '#1a1a2e',
      wordWrap: { width: 56 },
      align: 'center',
    });
    txt.setOrigin(0.5, 0.5);

    const pad = 4;
    const w = Math.max(txt.width + pad * 2, 16);
    const h = txt.height + pad * 2;

    const bg = scene.add.graphics();
    bg.fillStyle(type === 'thought' ? 0xe8e8f0 : 0xffffff, 0.92);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 3);

    bg.lineStyle(1, type === 'thought' ? 0x8888aa : 0x4a4a6e, 0.6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 3);

    if (type === 'thought') {
      bg.fillStyle(0xe8e8f0, 0.85);
      bg.fillCircle(0, h / 2 + 2, 2);
      bg.fillCircle(2, h / 2 + 5, 1.5);
    } else {
      bg.fillStyle(0xffffff, 0.92);
      bg.fillTriangle(-2, h / 2, 2, h / 2, 0, h / 2 + 4);
    }

    this.add([bg, txt]);

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
