import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { OfficeScene } from './scenes/OfficeScene';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from './map/OfficeMap';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: MAP_COLS * TILE_SIZE,
    height: MAP_ROWS * TILE_SIZE,
    pixelArt: true,
    backgroundColor: '#0a0a1a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloadScene, OfficeScene],
  };

  return new Phaser.Game(config);
}
