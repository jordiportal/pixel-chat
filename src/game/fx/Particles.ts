import Phaser from 'phaser';
import { TILE_SIZE } from '../map/OfficeMap';
import { getToolColor, FALLBACK_COLOR } from '../constants/ToolVisuals';

const PARTICLE_TEX = 'particle-dot';
const SPARK_TEX = 'particle-spark';
const STAR_TEX = 'particle-star';

function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PARTICLE_TEX)) {
    const tex = scene.textures.createCanvas(PARTICLE_TEX, 6, 6);
    const ctx = tex!.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3, 3, 3, 0, Math.PI * 2);
    ctx.fill();
    tex!.refresh();
  }
  if (!scene.textures.exists(SPARK_TEX)) {
    const tex = scene.textures.createCanvas(SPARK_TEX, 6, 6);
    const ctx = tex!.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 2, 6, 2);
    ctx.fillRect(2, 0, 2, 6);
    tex!.refresh();
  }
  if (!scene.textures.exists(STAR_TEX)) {
    const tex = scene.textures.createCanvas(STAR_TEX, 6, 6);
    const ctx = tex!.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 0, 2, 6);
    ctx.fillRect(0, 2, 6, 2);
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(4, 1, 1, 1);
    ctx.fillRect(1, 4, 1, 1);
    ctx.fillRect(4, 4, 1, 1);
    tex!.refresh();
  }
}

export class ParticleFX {
  private scene: Phaser.Scene;
  private thinkingEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private workingEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureTextures(scene);
  }

  emitThinking(x: number, y: number): void {
    this.stopThinking();
    this.thinkingEmitter = this.scene.add.particles(x, y - TILE_SIZE, PARTICLE_TEX, {
      speed: { min: 8, max: 20 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 1200,
      frequency: 300,
      tint: 0x8888cc,
      quantity: 1,
      blendMode: 'ADD',
    });
    this.thinkingEmitter.setDepth(49);
  }

  stopThinking(): void {
    this.thinkingEmitter?.destroy();
    this.thinkingEmitter = null;
  }

  emitWorking(x: number, y: number, actionType: string): void {
    this.stopWorking();
    const color = getToolColor(actionType);
    this.workingEmitter = this.scene.add.particles(x, y - TILE_SIZE * 0.5, SPARK_TEX, {
      speed: { min: 15, max: 40 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 800,
      frequency: 200,
      tint: color,
      quantity: 1,
      blendMode: 'ADD',
    });
    this.workingEmitter.setDepth(49);
  }

  stopWorking(): void {
    this.workingEmitter?.destroy();
    this.workingEmitter = null;
  }

  emitComplete(x: number, y: number): void {
    const emitter = this.scene.add.particles(x, y - TILE_SIZE * 0.5, STAR_TEX, {
      speed: { min: 30, max: 60 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      tint: 0x44dd66,
      quantity: 6,
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(49);
    emitter.explode(6);
    this.scene.time.delayedCall(800, () => emitter.destroy());
  }

  emitError(x: number, y: number): void {
    const emitter = this.scene.add.particles(x, y - TILE_SIZE * 0.5, SPARK_TEX, {
      speed: { min: 20, max: 50 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      tint: 0xff4444,
      quantity: 8,
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(49);
    emitter.explode(8);
    this.scene.time.delayedCall(700, () => emitter.destroy());
  }

  emitCelebration(x: number, y: number): void {
    const colors = [0xffcc44, 0x44ddff, 0xff66aa, 0x66ff66, 0xaa66ff];
    const emitter = this.scene.add.particles(x, y - TILE_SIZE, STAR_TEX, {
      speed: { min: 40, max: 100 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1200,
      gravityY: 60,
      tint: colors,
      quantity: 12,
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(100);
    emitter.explode(12);
    this.scene.time.delayedCall(1500, () => emitter.destroy());
  }

  emitDelegation(fromX: number, fromY: number, toX: number, toY: number): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(3, Math.floor(dist / (TILE_SIZE * 2)));

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const px = fromX + dx * t;
      const py = fromY + dy * t;

      this.scene.time.delayedCall(i * 80, () => {
        const emitter = this.scene.add.particles(px, py, STAR_TEX, {
          speed: { min: 5, max: 15 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 0.9, end: 0 },
          lifespan: 500,
          tint: 0xaa66ff,
          quantity: 2,
          blendMode: 'ADD',
          emitting: false,
        });
        emitter.setDepth(49);
        emitter.explode(2);
        this.scene.time.delayedCall(600, () => emitter.destroy());
      });
    }
  }

  emitArtifact(x: number, y: number, artifactType: string): void {
    const color = artifactType === 'image' ? 0xee6688
      : artifactType === 'spreadsheet' ? 0x44aa88
      : artifactType === 'slides' ? 0xee8844
      : 0x66aacc;

    const emitter = this.scene.add.particles(x, y - TILE_SIZE, STAR_TEX, {
      speed: { min: 20, max: 50 },
      angle: { min: 230, max: 310 },
      scale: { start: 0.9, end: 0.2 },
      alpha: { start: 1, end: 0 },
      lifespan: 1000,
      tint: color,
      quantity: 5,
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(49);
    emitter.explode(5);

    const label = this.scene.add.text(x, y - TILE_SIZE * 1.8, this.getArtifactEmoji(artifactType), {
      fontSize: `${Math.round(TILE_SIZE * 0.6)}px`,
      fontFamily: 'monospace',
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(100);

    this.scene.tweens.add({
      targets: label,
      y: y - TILE_SIZE * 3,
      alpha: 0,
      duration: 2000,
      ease: 'Quad.easeOut',
      onComplete: () => { label.destroy(); emitter.destroy(); },
    });
  }

  private getArtifactEmoji(type: string): string {
    switch (type) {
      case 'image': return '🖼️';
      case 'spreadsheet': return '📊';
      case 'slides': return '📑';
      case 'code': return '💻';
      case 'file': return '📄';
      default: return '✨';
    }
  }
}
