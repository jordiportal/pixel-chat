import Phaser from 'phaser';
import { TILE_SIZE, getZones } from '../map/OfficeMap';

interface SourceInfo {
  url: string;
  title: string;
  snippet: string;
  favicon?: string;
}

const MAX_CARDS = 3;
const CARD_W = TILE_SIZE * 3;
const CARD_H = TILE_SIZE * 0.8;
const CARD_PAD = 3;
const SHOW_DURATION = 4000;

export class SourceCards {
  private scene: Phaser.Scene;
  private activeCards: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(sources: SourceInfo[]): void {
    this.clearAll();

    const zone = getZones()['researchLab'];
    if (!zone) return;

    const baseX = zone.poi.x * TILE_SIZE;
    const baseY = (zone.bounds.y + 1) * TILE_SIZE;

    const displayed = sources.slice(0, MAX_CARDS);

    displayed.forEach((src, i) => {
      this.scene.time.delayedCall(i * 200, () => {
        const card = this.createCard(src, baseX, baseY + i * (CARD_H + 4));
        this.activeCards.push(card);

        card.setAlpha(0);
        card.setScale(0.8);
        this.scene.tweens.add({
          targets: card,
          alpha: 1,
          scale: 1,
          duration: 250,
          ease: 'Back.easeOut',
        });

        this.scene.time.delayedCall(SHOW_DURATION, () => {
          this.scene.tweens.add({
            targets: card,
            alpha: 0,
            y: card.y - TILE_SIZE * 0.5,
            duration: 400,
            ease: 'Quad.easeIn',
            onComplete: () => {
              card.destroy();
              const idx = this.activeCards.indexOf(card);
              if (idx !== -1) this.activeCards.splice(idx, 1);
            },
          });
        });
      });
    });
  }

  private createCard(src: SourceInfo, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    container.setDepth(60);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a2a3a, 0.9);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 3);
    bg.lineStyle(1, 0x44aadd, 0.5);
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 3);

    const globe = this.scene.add.text(-CARD_W / 2 + CARD_PAD + 2, 0, '🌐', {
      fontSize: `${Math.round(TILE_SIZE * 0.3)}px`,
      fontFamily: 'monospace',
    });
    globe.setOrigin(0, 0.5);

    const maxTitleLen = 24;
    const title = src.title.length > maxTitleLen
      ? src.title.slice(0, maxTitleLen - 2) + '..'
      : src.title;

    const titleText = this.scene.add.text(-CARD_W / 2 + CARD_PAD + TILE_SIZE * 0.5, 0, title, {
      fontSize: `${Math.round(TILE_SIZE * 0.28)}px`,
      fontFamily: 'monospace',
      color: '#ccddee',
      wordWrap: { width: CARD_W - TILE_SIZE * 0.7 },
    });
    titleText.setOrigin(0, 0.5);

    container.add([bg, globe, titleText]);
    return container;
  }

  private clearAll(): void {
    for (const card of this.activeCards) {
      card.destroy();
    }
    this.activeCards = [];
  }
}
