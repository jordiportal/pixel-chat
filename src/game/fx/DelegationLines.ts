import Phaser from 'phaser';
import type { Agent } from '../entities/Agent';

interface DelegationLink {
  fromId: string;
  toId: string;
  graphics: Phaser.GameObjects.Graphics;
  elapsed: number;
}

const DASH_LEN = 6;
const GAP_LEN = 4;
const LINE_COLOR = 0xaa66ff;
const LINE_ALPHA = 0.6;
const PULSE_SPEED = 0.003;

export class DelegationLines {
  private scene: Phaser.Scene;
  private links: DelegationLink[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  add(fromId: string, toId: string): void {
    const existing = this.links.find(l => l.fromId === fromId && l.toId === toId);
    if (existing) return;

    const graphics = this.scene.add.graphics();
    graphics.setDepth(5);
    this.links.push({ fromId, toId, graphics, elapsed: 0 });
  }

  remove(fromId: string, toId: string): void {
    const idx = this.links.findIndex(l => l.fromId === fromId && l.toId === toId);
    if (idx === -1) return;

    const link = this.links[idx];
    this.scene.tweens.add({
      targets: link.graphics,
      alpha: 0,
      duration: 400,
      onComplete: () => link.graphics.destroy(),
    });
    this.links.splice(idx, 1);
  }

  clearAll(): void {
    for (const link of this.links) {
      link.graphics.destroy();
    }
    this.links = [];
  }

  update(agents: Map<string, Agent>): void {
    const dt = this.scene.game.loop.delta;

    for (const link of this.links) {
      link.elapsed += dt;
      const from = agents.get(link.fromId);
      const to = agents.get(link.toId);
      if (!from || !to) continue;

      const g = link.graphics;
      g.clear();

      const fx = from.sprite.x;
      const fy = from.sprite.y;
      const tx = to.sprite.x;
      const ty = to.sprite.y;

      const dx = tx - fx;
      const dy = ty - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const offset = (link.elapsed * PULSE_SPEED) % (DASH_LEN + GAP_LEN);
      const pulseAlpha = 0.4 + 0.3 * Math.sin(link.elapsed * 0.005);

      g.lineStyle(1.5, LINE_COLOR, LINE_ALPHA * pulseAlpha);

      let pos = -offset;
      while (pos < dist) {
        const start = Math.max(pos, 0);
        const end = Math.min(pos + DASH_LEN, dist);
        if (end > start) {
          g.beginPath();
          g.moveTo(fx + nx * start, fy + ny * start);
          g.lineTo(fx + nx * end, fy + ny * end);
          g.strokePath();
        }
        pos += DASH_LEN + GAP_LEN;
      }

      const arrowLen = 4;
      const arrowX = tx - nx * 8;
      const arrowY = ty - ny * 8;
      const px = -ny;
      const py = nx;

      g.fillStyle(LINE_COLOR, LINE_ALPHA * pulseAlpha);
      g.fillTriangle(
        tx - nx * 4, ty - ny * 4,
        arrowX + px * arrowLen, arrowY + py * arrowLen,
        arrowX - px * arrowLen, arrowY - py * arrowLen,
      );
    }
  }
}
