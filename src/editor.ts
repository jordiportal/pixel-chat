/**
 * Map Editor — entry point
 */

import Phaser from 'phaser';
import { db } from './db/Database';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from './game/map/OfficeMap';
import { EditorScene } from './editor/EditorScene';
import { EditorPanel } from './editor/EditorPanel';
import { agentConfigService } from './services/AgentConfigService';
import { tileRegistry } from './services/TileRegistry';

async function boot(): Promise<void> {
  await db.init();
  await db.waitReady();

  if (!db.isOpen) {
    document.getElementById('editor-canvas')!.innerHTML =
      `<p style="color:#ff6b6b;padding:2rem">Error: no se pudo inicializar la base de datos.<br/>${db.initError ?? ''}</p>`;
    return;
  }

  await tileRegistry.load();
  agentConfigService.fetchSkills().catch(() => {});

  const VIEWPORT_COLS = Math.min(MAP_COLS, 20);
  const VIEWPORT_ROWS = Math.min(MAP_ROWS, 15);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'editor-canvas',
    width: VIEWPORT_COLS * TILE_SIZE,
    height: VIEWPORT_ROWS * TILE_SIZE,
    pixelArt: true,
    backgroundColor: '#0a0a1a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [EditorScene],
  });

  const panel = new EditorPanel();
  panel.init();
}

boot().catch(err => {
  console.error('[Editor] Boot failed:', err);
});
