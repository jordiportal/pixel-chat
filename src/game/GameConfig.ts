import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { OfficeScene } from './scenes/OfficeScene';
import { TILE_SIZE } from './map/OfficeMap';

const VIEWPORT_COLS = 16;
const VIEWPORT_ROWS = 12;

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: VIEWPORT_COLS * TILE_SIZE,
    height: VIEWPORT_ROWS * TILE_SIZE,
    pixelArt: true,
    backgroundColor: '#0a0a1a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      keyboard: {
        target: window,
      },
    },
    scene: [PreloadScene, OfficeScene],
  };

  const game = new Phaser.Game(config);

  game.events.on('ready', () => {
    const canvas = game.canvas;
    canvas.setAttribute('tabindex', '0');

    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.addEventListener('focusin', () => {
        game.input.keyboard!.enabled = false;
      });
      chatContainer.addEventListener('focusout', () => {
        game.input.keyboard!.enabled = true;
      });
    }
  });

  return game;
}
