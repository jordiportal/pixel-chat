import { TILE, TILE_SIZE, MAP_COLS, MAP_ROWS, getZones, DEFAULT_ZONES, parseMapData, getTileName } from '../game/map/OfficeMap';
import { drawTile } from '../game/scenes/PreloadScene';
import { db, type ZoneRow } from '../db/Database';
import { eventBus } from '../events/EventBus';
import { agentConfigService } from '../services/AgentConfigService';
import { agentConfigPanel } from '../ui/AgentConfigPanel';
import { tileRegistry } from '../services/TileRegistry';

export class EditorPanel {
  private selectedTile: number = TILE.FLOOR;

  init(): void {
    this.bindSaveButton();
    this.buildTilePalette();
    this.buildTileManager();
    this.buildToolsBar();
    this.buildZoneEditor();
    this.buildAgentSection();
    this.buildActions();
    this.bindStatusBar();
  }

  // ── Save Button ─────────────────────────────────────────────

  private bindSaveButton(): void {
    const btn = document.getElementById('btn-save');
    const statusEl = document.getElementById('save-status');

    btn?.addEventListener('click', () => {
      eventBus.emit('editor:requestSave');
    });

    eventBus.on('editor:dirty', () => {
      if (statusEl) {
        statusEl.textContent = '● Cambios sin guardar';
        statusEl.className = 'save-status dirty';
      }
      if (btn) btn.classList.add('has-changes');
    });

    eventBus.on('editor:saved', () => {
      if (statusEl) {
        statusEl.textContent = '✓ Guardado';
        statusEl.className = 'save-status saved';
        setTimeout(() => {
          if (statusEl.classList.contains('saved')) {
            statusEl.textContent = 'Sin cambios';
            statusEl.className = 'save-status';
          }
        }, 3000);
      }
      if (btn) btn.classList.remove('has-changes');
    });
  }

  // ── Tile Palette ────────────────────────────────────────────

  buildTilePalette(): void {
    const container = document.getElementById('tile-palette');
    if (!container) return;

    const tiles = tileRegistry.getAll();
    container.innerHTML = '<h3>Tiles</h3><div class="palette-grid"></div>';
    const grid = container.querySelector('.palette-grid')!;

    for (const t of tiles) {
      const item = document.createElement('div');
      item.className = 'palette-item' + (t.id === this.selectedTile ? ' selected' : '');
      item.dataset.tile = String(t.id);
      item.title = t.name;

      const canvas = document.createElement('canvas');
      canvas.width = TILE_SIZE;
      canvas.height = TILE_SIZE;
      const ctx = canvas.getContext('2d')!;
      drawTile(ctx, 0, t.id);

      const label = document.createElement('span');
      label.textContent = t.name;

      item.appendChild(canvas);
      item.appendChild(label);
      grid.appendChild(item);

      item.addEventListener('click', () => {
        grid.querySelector('.selected')?.classList.remove('selected');
        item.classList.add('selected');
        this.selectedTile = t.id;
        eventBus.emit('editor:selectTile', t.id);
      });
    }
  }

  // ── Tile Manager ───────────────────────────────────────────

  private buildTileManager(): void {
    const container = document.getElementById('tile-manager');
    if (!container) return;
    this.renderTileManager(container);
  }

  private renderTileManager(container: HTMLElement): void {
    const tiles = tileRegistry.getAll();
    let html = '<h3>Gestor de Tiles</h3>';
    html += '<div class="tile-manager-list">';

    for (const t of tiles) {
      const isBuiltin = tileRegistry.isBuiltin(t.id);
      html += `
        <div class="tm-item" data-id="${t.id}">
          <canvas class="tm-preview" width="${TILE_SIZE}" height="${TILE_SIZE}"></canvas>
          <div class="tm-info">
            <span class="tm-name">${t.name}</span>
            <span class="tm-flags">
              ${t.walkable ? '<span class="tm-flag walk" title="Caminable">W</span>' : ''}
              ${t.interactable ? '<span class="tm-flag interact" title="Interactuable">I</span>' : ''}
              ${t.spriteData ? '<span class="tm-flag custom" title="Sprite custom">S</span>' : ''}
            </span>
          </div>
          <div class="tm-actions">
            <button class="tm-edit-btn" data-id="${t.id}" title="Editar">✎</button>
            ${isBuiltin && t.spriteData ? `<button class="tm-restore-btn" data-id="${t.id}" title="Restaurar original">↺</button>` : ''}
            ${!isBuiltin ? `<button class="tm-del-btn" data-id="${t.id}" title="Eliminar">✕</button>` : ''}
          </div>
        </div>
        <div class="tm-form hidden" data-id="${t.id}">
          <div class="tm-form-row">
            <label>Nombre</label>
            <input type="text" class="tmf-name" value="${t.name}" />
          </div>
          <div class="tm-form-row">
            <label>Código</label>
            <input type="text" class="tmf-char" value="${t.charCode}" maxlength="1" style="width:2em" />
            <label><input type="checkbox" class="tmf-walkable" ${t.walkable ? 'checked' : ''} /> Caminable</label>
            <label><input type="checkbox" class="tmf-interactable" ${t.interactable ? 'checked' : ''} /> Interactuable</label>
          </div>
          <div class="tm-form-row">
            <label>Sprite PNG ${TILE_SIZE}x${TILE_SIZE}</label>
            <input type="file" class="tmf-file" accept=".png,image/png" />
            <canvas class="tmf-preview" width="${TILE_SIZE * 2}" height="${TILE_SIZE * 2}"></canvas>
          </div>
          <div class="tm-form-actions">
            <button class="tm-save-btn" data-id="${t.id}">Guardar</button>
            <button class="tm-cancel-btn" data-id="${t.id}">Cancelar</button>
          </div>
        </div>
      `;
    }

    html += '</div>';
    html += `
      <div class="tm-add-row">
        <button id="tm-add-btn" class="editor-btn primary wide">+ Nuevo tile</button>
      </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.tm-preview').forEach(canvas => {
      const item = (canvas as HTMLCanvasElement).closest('.tm-item');
      if (!item) return;
      const id = parseInt(item.getAttribute('data-id')!);
      const ctx = (canvas as HTMLCanvasElement).getContext('2d')!;
      drawTile(ctx, 0, id);
    });

    this.bindTileManagerEvents(container);
  }

  private bindTileManagerEvents(container: HTMLElement): void {
    container.querySelectorAll('.tm-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        const form = container.querySelector(`.tm-form[data-id="${id}"]`) as HTMLElement;
        form?.classList.toggle('hidden');
        this.updateFormPreview(container, parseInt(id));
      });
    });

    container.querySelectorAll('.tm-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        const form = container.querySelector(`.tm-form[data-id="${id}"]`) as HTMLElement;
        form?.classList.add('hidden');
      });
    });

    container.querySelectorAll('.tm-save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt((btn as HTMLElement).dataset.id!);
        await this.saveTileFromForm(container, id);
      });
    });

    container.querySelectorAll('.tm-restore-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt((btn as HTMLElement).dataset.id!);
        const def = tileRegistry.getDef(id);
        if (!def) return;
        await db.upsertTileDef({
          id, name: def.name, char_code: def.charCode,
          walkable: def.walkable ? 1 : 0,
          interactable: def.interactable ? 1 : 0,
          sprite_data: null,
        });
        await this.refreshAfterTileChange(container);
      });
    });

    container.querySelectorAll('.tm-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt((btn as HTMLElement).dataset.id!);
        if (!confirm(`Eliminar tile ${tileRegistry.getName(id)}?`)) return;
        await db.deleteTileDef(id);
        await this.refreshAfterTileChange(container);
      });
    });

    container.querySelectorAll('.tmf-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const form = (e.target as HTMLElement).closest('.tm-form') as HTMLElement;
        if (!form) return;

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const img = new Image();
          img.onload = () => {
            if (img.width !== TILE_SIZE || img.height !== TILE_SIZE) {
              alert(`El sprite debe ser ${TILE_SIZE}x${TILE_SIZE} px (recibido: ${img.width}x${img.height})`);
              return;
            }
            form.dataset.spriteData = dataUrl;
            const previewCanvas = form.querySelector('.tmf-preview') as HTMLCanvasElement;
            if (previewCanvas) {
              const pSize = TILE_SIZE * 2;
              const ctx = previewCanvas.getContext('2d')!;
              ctx.clearRect(0, 0, pSize, pSize);
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0, pSize, pSize);
            }
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
    });

    container.querySelector('#tm-add-btn')?.addEventListener('click', async () => {
      const nextId = db.getNextTileId();
      const usedChars = new Set(tileRegistry.getAll().map(t => t.charCode));
      let charCode = '?';
      for (const ch of 'abdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
        if (!usedChars.has(ch)) { charCode = ch; break; }
      }
      await db.upsertTileDef({
        id: nextId,
        name: `Tile ${nextId}`,
        char_code: charCode,
        walkable: 0,
        interactable: 0,
        sprite_data: null,
      });
      await this.refreshAfterTileChange(container);
    });
  }

  private updateFormPreview(container: HTMLElement, id: number): void {
    const form = container.querySelector(`.tm-form[data-id="${id}"]`) as HTMLElement;
    if (!form) return;
    const sprite = tileRegistry.getSpriteImage(id);
    const previewCanvas = form.querySelector('.tmf-preview') as HTMLCanvasElement;
    if (previewCanvas && sprite) {
      const pSize = TILE_SIZE * 2;
      const ctx = previewCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, pSize, pSize);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, 0, 0, pSize, pSize);
    }
  }

  private async saveTileFromForm(container: HTMLElement, id: number): Promise<void> {
    const form = container.querySelector(`.tm-form[data-id="${id}"]`) as HTMLElement;
    if (!form) return;

    const name = (form.querySelector('.tmf-name') as HTMLInputElement).value.trim() || `Tile ${id}`;
    const charCode = (form.querySelector('.tmf-char') as HTMLInputElement).value.trim() || '?';
    const walkable = (form.querySelector('.tmf-walkable') as HTMLInputElement).checked ? 1 : 0;
    const interactable = (form.querySelector('.tmf-interactable') as HTMLInputElement).checked ? 1 : 0;

    const existingDef = tileRegistry.getDef(id);
    const spriteData = form.dataset.spriteData ?? existingDef?.spriteData ?? null;

    await db.upsertTileDef({ id, name, char_code: charCode, walkable, interactable, sprite_data: spriteData });
    delete form.dataset.spriteData;

    await this.refreshAfterTileChange(container);
  }

  private async refreshAfterTileChange(container: HTMLElement): Promise<void> {
    await tileRegistry.load();
    this.renderTileManager(container);
    this.buildTilePalette();
    eventBus.emit('editor:tilesChanged');
  }

  // ── Tools Bar ───────────────────────────────────────────────

  private buildToolsBar(): void {
    const container = document.getElementById('tools-bar');
    if (!container) return;

    container.innerHTML = `
      <h3>Herramientas</h3>
      <div class="tools-row">
        <button class="tool-btn active" data-tool="paint" title="Pintar">🖌️</button>
        <button class="tool-btn" data-tool="erase" title="Borrar (suelo)">🧹</button>
        <button class="tool-btn" data-tool="fill" title="Rellenar fila">📏</button>
      </div>
    `;

    let currentTool = 'paint';
    container.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        currentTool = (btn as HTMLElement).dataset.tool!;
        if (currentTool === 'erase') {
          this.selectedTile = TILE.FLOOR;
          eventBus.emit('editor:selectTile', TILE.FLOOR);
        }
      });
    });
  }

  // ── Zone Editor ─────────────────────────────────────────────

  private buildZoneEditor(): void {
    const container = document.getElementById('zone-editor');
    if (!container) return;
    this.renderZoneList(container);
  }

  private renderZoneList(container: HTMLElement): void {
    const zones = getZones();
    const rows = Object.values(zones);

    let html = '<h3>Zonas</h3>';

    if (rows.length === 0) {
      html += '<p class="editor-empty">Sin zonas definidas.</p>';
    } else {
      html += rows.map(z => `
        <div class="zone-item" data-zone="${z.name}">
          <div class="zone-header">
            <strong>${z.label}</strong>
            <span class="zone-coords">(${z.bounds.x},${z.bounds.y}) ${z.bounds.w}x${z.bounds.h} POI:${z.poi.x},${z.poi.y}</span>
            <button class="zone-edit-btn" data-zone="${z.name}" title="Editar">✎</button>
            <button class="zone-del-btn" data-zone="${z.name}" title="Eliminar">✕</button>
          </div>
          <div class="zone-form hidden" data-zone="${z.name}">
            <div class="zone-form-row">
              <label>ID</label><input type="text" class="zf-id" value="${z.name}" disabled />
              <label>Label</label><input type="text" class="zf-label" value="${z.label}" />
            </div>
            <div class="zone-form-row">
              <label>X</label><input type="number" class="zf-bx" value="${z.bounds.x}" min="0" max="${MAP_COLS - 1}" />
              <label>Y</label><input type="number" class="zf-by" value="${z.bounds.y}" min="0" max="${MAP_ROWS - 1}" />
              <label>W</label><input type="number" class="zf-bw" value="${z.bounds.w}" min="1" max="${MAP_COLS}" />
              <label>H</label><input type="number" class="zf-bh" value="${z.bounds.h}" min="1" max="${MAP_ROWS}" />
            </div>
            <div class="zone-form-row">
              <label>POI X</label><input type="number" class="zf-px" value="${z.poi.x}" min="0" max="${MAP_COLS - 1}" />
              <label>POI Y</label><input type="number" class="zf-py" value="${z.poi.y}" min="0" max="${MAP_ROWS - 1}" />
            </div>
            <div class="zone-form-actions">
              <button class="zone-save-btn" data-zone="${z.name}">Guardar</button>
              <button class="zone-cancel-btn" data-zone="${z.name}">Cancelar</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    html += `
      <div class="zone-add-row">
        <input type="text" id="new-zone-id" placeholder="ID (ej: breakRoom)" />
        <input type="text" id="new-zone-label" placeholder="Label" />
        <button id="zone-add-btn" class="editor-btn primary">+ Zona</button>
      </div>
      <button id="zone-reset-btn" class="editor-btn danger small">Reset zonas</button>
    `;

    container.innerHTML = html;
    this.bindZoneEvents(container);
  }

  private bindZoneEvents(container: HTMLElement): void {
    container.querySelectorAll('.zone-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const zoneId = (btn as HTMLElement).dataset.zone!;
        const form = container.querySelector(`.zone-form[data-zone="${zoneId}"]`) as HTMLElement;
        form.classList.toggle('hidden');
      });
    });

    container.querySelectorAll('.zone-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const zoneId = (btn as HTMLElement).dataset.zone!;
        const form = container.querySelector(`.zone-form[data-zone="${zoneId}"]`) as HTMLElement;
        form.classList.add('hidden');
      });
    });

    container.querySelectorAll('.zone-save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const zoneId = (btn as HTMLElement).dataset.zone!;
        const form = container.querySelector(`.zone-form[data-zone="${zoneId}"]`)!;
        const zone: ZoneRow = {
          id: zoneId,
          label: (form.querySelector('.zf-label') as HTMLInputElement).value,
          bounds_x: parseInt((form.querySelector('.zf-bx') as HTMLInputElement).value),
          bounds_y: parseInt((form.querySelector('.zf-by') as HTMLInputElement).value),
          bounds_w: parseInt((form.querySelector('.zf-bw') as HTMLInputElement).value),
          bounds_h: parseInt((form.querySelector('.zf-bh') as HTMLInputElement).value),
          poi_x: parseInt((form.querySelector('.zf-px') as HTMLInputElement).value),
          poi_y: parseInt((form.querySelector('.zf-py') as HTMLInputElement).value),
        };
        await db.upsertZone(zone);
        this.renderZoneList(container);
        eventBus.emit('editor:zonesChanged');
      });
    });

    container.querySelectorAll('.zone-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const zoneId = (btn as HTMLElement).dataset.zone!;
        await db.deleteZone(zoneId);
        this.renderZoneList(container);
        eventBus.emit('editor:zonesChanged');
      });
    });

    container.querySelector('#zone-add-btn')?.addEventListener('click', async () => {
      const idInput = container.querySelector('#new-zone-id') as HTMLInputElement;
      const labelInput = container.querySelector('#new-zone-label') as HTMLInputElement;
      const id = idInput.value.trim();
      const label = labelInput.value.trim() || id;
      if (!id) return;

      await db.upsertZone({
        id, label,
        bounds_x: 1, bounds_y: 1, bounds_w: 5, bounds_h: 5,
        poi_x: 3, poi_y: 3,
      });
      this.renderZoneList(container);
      eventBus.emit('editor:zonesChanged');
    });

    container.querySelector('#zone-reset-btn')?.addEventListener('click', async () => {
      await db.deleteAllZones();
      for (const z of Object.values(DEFAULT_ZONES)) {
        await db.upsertZone({
          id: z.name, label: z.label,
          bounds_x: z.bounds.x, bounds_y: z.bounds.y,
          bounds_w: z.bounds.w, bounds_h: z.bounds.h,
          poi_x: z.poi.x, poi_y: z.poi.y,
        });
      }
      this.renderZoneList(container);
      eventBus.emit('editor:zonesChanged');
    });
  }

  // ── Agent Config Section ────────────────────────────────────

  private buildAgentSection(): void {
    const container = document.getElementById('agent-config-section');
    if (!container) return;

    container.innerHTML = `
      <h3>Agentes</h3>
      <button id="open-agent-config" class="editor-btn primary wide">Configurar agentes</button>
      <p class="editor-hint" id="agent-count-hint"></p>
    `;

    this.updateAgentCount();

    container.querySelector('#open-agent-config')?.addEventListener('click', async () => {
      await agentConfigPanel.show();
    });

    eventBus.on('agents:loaded', () => {
      this.updateAgentCount();
      eventBus.emit('editor:agentsChanged');
    });
  }

  private updateAgentCount(): void {
    const hint = document.getElementById('agent-count-hint');
    if (hint) {
      const count = db.agentCount();
      hint.textContent = count > 0 ? `${count} agente(s) configurado(s)` : 'Sin agentes configurados';
    }
  }

  // ── Actions (export/import/reset) ───────────────────────────

  private buildActions(): void {
    const container = document.getElementById('editor-actions');
    if (!container) return;

    container.innerHTML = `
      <h3>Acciones</h3>
      <div class="actions-grid">
        <button id="btn-export" class="editor-btn">Exportar mapa</button>
        <button id="btn-import" class="editor-btn">Importar mapa</button>
        <button id="btn-reset" class="editor-btn danger">Reset al default</button>
      </div>
      <input type="file" id="import-file" accept=".json" style="display:none" />
    `;

    container.querySelector('#btn-export')?.addEventListener('click', () => {
      const customTiles = tileRegistry.getAll().filter(t => !tileRegistry.isBuiltin(t.id) || t.spriteData);
      const data = {
        grid: parseMapData(),
        zones: getZones(),
        cols: MAP_COLS, rows: MAP_ROWS,
        tileDefs: customTiles,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pixel-chat-map.json';
      a.click();
    });

    container.querySelector('#btn-import')?.addEventListener('click', () => {
      (container.querySelector('#import-file') as HTMLInputElement).click();
    });

    container.querySelector('#import-file')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);

        if (data.tileDefs && Array.isArray(data.tileDefs)) {
          for (const t of data.tileDefs) {
            await db.upsertTileDef({
              id: t.id,
              name: t.name,
              char_code: t.charCode ?? t.char_code ?? '?',
              walkable: t.walkable ? 1 : 0,
              interactable: t.interactable ? 1 : 0,
              sprite_data: t.spriteData ?? t.sprite_data ?? null,
            });
          }
          await tileRegistry.load();
          const mgr = document.getElementById('tile-manager');
          if (mgr) this.renderTileManager(mgr);
          this.buildTilePalette();
          eventBus.emit('editor:tilesChanged');
        }

        if (data.grid) {
          eventBus.emit('editor:importMap', data.grid);
        }
        if (data.zones) {
          await db.deleteAllZones();
          for (const [id, z] of Object.entries(data.zones) as [string, any][]) {
            await db.upsertZone({
              id, label: z.label,
              bounds_x: z.bounds.x, bounds_y: z.bounds.y,
              bounds_w: z.bounds.w, bounds_h: z.bounds.h,
              poi_x: z.poi.x, poi_y: z.poi.y,
            });
          }
          eventBus.emit('editor:zonesChanged');
          this.buildZoneEditor();
        }
      } catch (err) {
        console.error('[Editor] Import error:', err);
        alert('Error importando archivo JSON');
      }
    });

    container.querySelector('#btn-reset')?.addEventListener('click', async () => {
      if (!confirm('Esto restaurará el mapa al default. ¿Continuar?')) return;
      await db.deleteMapGrid();
      eventBus.emit('editor:resetMap');
    });
  }

  // ── Status Bar ──────────────────────────────────────────────

  private bindStatusBar(): void {
    const coordsEl = document.getElementById('status-coords');
    const tileEl = document.getElementById('status-tile');
    const zoneEl = document.getElementById('status-zone');

    eventBus.on('editor:hover', (info: { x: number; y: number; tile: number }) => {
      if (coordsEl) coordsEl.textContent = `(${info.x}, ${info.y})`;
      if (tileEl) tileEl.textContent = getTileName(info.tile);

      if (zoneEl) {
        const zones = getZones();
        let found = '';
        for (const z of Object.values(zones)) {
          const b = z.bounds;
          if (info.x >= b.x && info.x < b.x + b.w && info.y >= b.y && info.y < b.y + b.h) {
            found = z.label;
            break;
          }
        }
        zoneEl.textContent = found || '-';
      }
    });

    eventBus.on('editor:saved', () => {
      const bar = document.getElementById('editor-status-bar');
      if (bar) {
        bar.classList.add('saved');
        setTimeout(() => bar.classList.remove('saved'), 800);
      }
    });
  }
}
