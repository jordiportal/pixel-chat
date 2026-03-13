/**
 * Agent Configuration Panel — modal UI for managing agents.
 */

import { agentConfigService, type UnconfiguredSkill } from '../services/AgentConfigService';
import { generateColors, findFreePosition } from '../utils/AgentGenerator';
import { db, type AgentRow, type ToolMappingRow } from '../db/Database';
import { ZONES } from '../game/map/OfficeMap';

export class AgentConfigPanel {
  private overlay: HTMLElement | null = null;

  async show(): Promise<void> {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay agent-config-overlay';
    this.overlay.innerHTML = `
      <div class="settings-panel acp-panel">
        <div class="acp-header">
          <h3>Configuraci&oacute;n de Agentes</h3>
          <button class="acp-close">&times;</button>
        </div>
        <div class="acp-body"><p class="acp-empty">Cargando...</p></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    this.overlay.querySelector('.acp-close')?.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    try {
      await db.waitReady();

      if (!db.isOpen) {
        if (!this.overlay) return;
        const body = this.overlay.querySelector('.acp-body');
        if (body) body.innerHTML = `<p class="acp-empty" style="color:#ff6b6b">
          Error: La base de datos no se pudo inicializar.<br/>
          <small>${db.initError ?? 'Error desconocido al cargar sql-wasm.wasm'}</small>
        </p>`;
        return;
      }

      await this.renderContent();
    } catch (err) {
      console.error('[AgentConfigPanel] Error loading:', err);
      if (!this.overlay) return;
      const body = this.overlay.querySelector('.acp-body');
      if (body) body.innerHTML = `<p class="acp-empty" style="color:#ff6b6b">Error al cargar: ${err instanceof Error ? err.message : 'Desconocido'}</p>`;
    }
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private async renderContent(): Promise<void> {
    if (!this.overlay) return;
    const unconfigured = await agentConfigService.getUnconfiguredSkills();
    const configured = agentConfigService.getConfiguredAgents();

    this.overlay.innerHTML = this.buildHTML(unconfigured, configured);
    this.bind(unconfigured, configured);
  }

  // ── HTML builders ─────────────────────────────────────────────

  private zoneOptions(selected: string): string {
    return Object.entries(ZONES)
      .map(([k, v]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${v.label}</option>`)
      .join('');
  }

  private buildAgentForm(prefix: string, idx: number, vals: {
    name: string; zone: string; bodyColor: string; hairColor: string; homeX: number; homeY: number;
  }): string {
    return `
      <div class="acp-skill-form">
        <div class="acp-field">
          <label>Nombre</label>
          <input type="text" class="${prefix}-input-name" value="${this.esc(vals.name)}" />
        </div>
        <div class="acp-field">
          <label>Zona</label>
          <select class="${prefix}-input-zone">${this.zoneOptions(vals.zone)}</select>
        </div>
        <div class="acp-field acp-field-inline">
          <div>
            <label>Color cuerpo</label>
            <input type="color" class="${prefix}-input-body-color" value="${vals.bodyColor}" />
          </div>
          <div>
            <label>Color pelo</label>
            <input type="color" class="${prefix}-input-hair-color" value="${vals.hairColor}" />
          </div>
          <div>
            <label>Pos X</label>
            <input type="number" class="${prefix}-input-x" value="${vals.homeX}" min="1" max="30" />
          </div>
          <div>
            <label>Pos Y</label>
            <input type="number" class="${prefix}-input-y" value="${vals.homeY}" min="1" max="22" />
          </div>
        </div>
        <div class="acp-skill-preview">
          <div class="acp-preview-avatar" style="background:${vals.bodyColor}">
            <div class="acp-preview-hair" style="background:${vals.hairColor}"></div>
          </div>
        </div>
        <div class="acp-skill-actions">
          <button class="acp-btn ${prefix}-btn-randomize" data-index="${idx}">Aleatorio</button>
          <button class="acp-btn acp-btn-primary ${prefix}-btn-save" data-index="${idx}">Guardar</button>
        </div>
      </div>
    `;
  }

  /** Builds <option> list of concrete map element instances (e.g. "Monitor - Oficina Principal (7,1)") */
  private mapElementOptions(selectedType: string | null, selectedX: number | null, selectedY: number | null): string {
    const elements = agentConfigService.getMapElements();
    const selectedKey = (selectedType && selectedX != null && selectedY != null)
      ? `${selectedType}:${selectedX}:${selectedY}` : '';

    let html = `<option value="">Sin elemento</option>`;
    let lastZone = '';
    for (const el of elements) {
      if (el.zone !== lastZone) {
        if (lastZone) html += '</optgroup>';
        html += `<optgroup label="${this.esc(el.zoneLabel)}">`;
        lastZone = el.zone;
      }
      const key = `${el.type}:${el.x}:${el.y}`;
      html += `<option value="${key}"${key === selectedKey ? ' selected' : ''}>${el.label} (${el.x}, ${el.y})</option>`;
    }
    if (lastZone) html += '</optgroup>';
    return html;
  }

  /** Builds <option> list of tools available for a specific agent */
  private toolSelectOptions(agentId: string, existing: Set<string>): string {
    const tools = agentConfigService.getToolsForAgent(agentId);
    const agentTools = tools.filter(t => t.source === 'agent' && !existing.has(t.name));
    const coreTools = tools.filter(t => t.source === 'core' && !existing.has(t.name));

    let html = '';
    if (agentTools.length > 0) {
      html += `<optgroup label="Herramientas del agente">`;
      html += agentTools.map(t => `<option value="${t.name}">${t.label}</option>`).join('');
      html += `</optgroup>`;
    }
    if (coreTools.length > 0) {
      html += `<optgroup label="Herramientas generales">`;
      html += coreTools.map(t => `<option value="${t.name}">${t.label}</option>`).join('');
      html += `</optgroup>`;
    }
    return html;
  }

  private buildToolsSection(agentId: string, mappings: ToolMappingRow[]): string {
    const existingTools = new Set(mappings.map(m => m.tool_name));

    const mappingRows = mappings.map(m => `
      <div class="acp-tool-row" data-agent="${this.esc(agentId)}" data-tool="${this.esc(m.tool_name)}">
        <span class="acp-tool-name">${this.esc(m.label)}</span>
        <span class="acp-tool-arrow">→</span>
        <select class="acp-tool-element">${this.mapElementOptions(m.tile_type, m.target_x, m.target_y)}</select>
        <button class="acp-btn acp-tool-update" data-agent="${this.esc(agentId)}" data-tool="${this.esc(m.tool_name)}" data-label="${this.esc(m.label)}">OK</button>
        <button class="acp-btn acp-btn-danger acp-tool-delete" data-agent="${this.esc(agentId)}" data-tool="${this.esc(m.tool_name)}">✕</button>
      </div>
    `).join('');

    const availableOptions = this.toolSelectOptions(agentId, existingTools);

    return `
      <div class="acp-tools-section" data-agent="${this.esc(agentId)}">
        <h5>Herramientas → Elementos</h5>
        ${mappingRows || '<p class="acp-empty">Sin herramientas mapeadas. Agrega una para que el agente interactúe con elementos del mapa.</p>'}
        <div class="acp-tool-add">
          <select class="acp-tool-add-select">
            <option value="">Agregar herramienta...</option>
            ${availableOptions}
          </select>
          <input type="text" class="acp-tool-add-custom" placeholder="O nombre custom" />
          <button class="acp-btn acp-btn-primary acp-tool-add-btn" data-agent="${this.esc(agentId)}">+</button>
        </div>
      </div>
    `;
  }

  private buildHTML(unconfigured: UnconfiguredSkill[], configured: AgentRow[]): string {
    const unconfiguredRows = unconfigured.length === 0
      ? '<p class="acp-empty">Todos los agentes A2A ya est&aacute;n configurados.</p>'
      : unconfigured.map((u, i) => `
        <div class="acp-skill-row" data-index="${i}">
          <div class="acp-skill-header">
            <span class="acp-skill-name">${this.esc(u.skill.name)}</span>
            <span class="acp-skill-id">${this.esc(u.skill.id)}</span>
            <span class="acp-skill-tags">${u.skill.tags.map(t => `<span class="acp-tag">${this.esc(t)}</span>`).join('')}</span>
          </div>
          ${this.buildAgentForm('acp-new', i, {
            name: u.suggested.name, zone: u.suggested.zone,
            bodyColor: u.suggested.bodyColor, hairColor: u.suggested.hairColor,
            homeX: u.suggested.homeX, homeY: u.suggested.homeY,
          })}
        </div>
      `).join('');

    const configuredRows = configured.length === 0
      ? '<p class="acp-empty">No hay agentes configurados.</p>'
      : configured.map((a, i) => {
        const toolMappings = agentConfigService.getToolMappings(a.id);
        return `
        <div class="acp-agent-row" data-agent-id="${this.esc(a.id)}" data-index="${i}">
          <div class="acp-agent-summary" data-index="${i}">
            <div class="acp-agent-preview" style="background:${a.body_color}">
              <div class="acp-preview-hair" style="background:${a.hair_color}"></div>
            </div>
            <div class="acp-agent-info">
              <strong>${this.esc(a.name)}</strong>
              <span class="acp-agent-meta">${this.esc(a.skill_id)} | ${ZONES[a.zone]?.label ?? a.zone} (${a.home_x}, ${a.home_y})${toolMappings.length > 0 ? ` | ${toolMappings.length} tools` : ''}</span>
            </div>
            <button class="acp-btn acp-btn-edit" data-index="${i}" title="Editar">✎</button>
            <button class="acp-btn acp-btn-danger acp-btn-delete" data-id="${this.esc(a.id)}" title="Eliminar">✕</button>
          </div>
          <div class="acp-agent-edit hidden" data-index="${i}">
            ${this.buildAgentForm('acp-edit', i, {
              name: a.name, zone: a.zone,
              bodyColor: a.body_color, hairColor: a.hair_color,
              homeX: a.home_x, homeY: a.home_y,
            })}
            ${this.buildToolsSection(a.id, toolMappings)}
          </div>
        </div>
      `}).join('');

    return `
      <div class="settings-panel acp-panel">
        <div class="acp-header">
          <h3>Configuraci&oacute;n de Agentes</h3>
          <button class="acp-close">&times;</button>
        </div>

        <div class="acp-body">
          <div class="acp-section">
            <h4>Agentes A2A pendientes (${unconfigured.length})</h4>
            ${unconfigured.length > 1 ? '<button class="acp-btn acp-btn-primary acp-btn-configure-all">Configurar todos (aleatorio)</button>' : ''}
            ${unconfiguredRows}
          </div>

          <div class="acp-section">
            <h4>Agentes configurados (${configured.length})</h4>
            ${configured.length > 0 ? '<button class="acp-btn acp-btn-danger acp-btn-delete-all">Eliminar todos</button>' : ''}
            ${configuredRows}
          </div>
        </div>
      </div>
    `;
  }

  // ── Event binding ─────────────────────────────────────────────

  private bind(unconfigured: UnconfiguredSkill[], configured: AgentRow[]): void {
    if (!this.overlay) return;

    // Close
    this.overlay.querySelector('.acp-close')?.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.bindNewAgents(unconfigured);
    this.bindConfiguredAgents(configured);
    this.bindColorPreviews();
  }

  private bindNewAgents(unconfigured: UnconfiguredSkill[]): void {
    if (!this.overlay) return;

    this.overlay.querySelectorAll('.acp-new-btn-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt((btn as HTMLElement).dataset.index ?? '0');
        await this.saveNewSkill(unconfigured[idx], idx);
      });
    });

    this.overlay.querySelectorAll('.acp-new-btn-randomize').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.index ?? '0');
        this.randomizeForm(this.overlay!.querySelector(`.acp-skill-row[data-index="${idx}"]`)!, 'acp-new', unconfigured[idx].skill.id);
      });
    });

    this.overlay.querySelector('.acp-btn-configure-all')?.addEventListener('click', async () => {
      const count = await agentConfigService.configureAllRandom();
      console.log(`[AgentConfigPanel] Configured ${count} agents`);
      this.refresh();
    });
  }

  private bindConfiguredAgents(configured: AgentRow[]): void {
    if (!this.overlay) return;

    // Toggle edit form
    this.overlay.querySelectorAll('.acp-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = (btn as HTMLElement).dataset.index!;
        const editPanel = this.overlay!.querySelector(`.acp-agent-edit[data-index="${idx}"]`) as HTMLElement;
        editPanel.classList.toggle('hidden');
        (btn as HTMLElement).textContent = editPanel.classList.contains('hidden') ? '✎' : '✕';
      });
    });

    // Save edit
    this.overlay.querySelectorAll('.acp-edit-btn-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt((btn as HTMLElement).dataset.index ?? '0');
        await this.saveEditedAgent(configured[idx], idx);
      });
    });

    // Randomize edit
    this.overlay.querySelectorAll('.acp-edit-btn-randomize').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.index ?? '0');
        const row = this.overlay!.querySelector(`.acp-agent-row[data-index="${idx}"]`)!;
        this.randomizeForm(row, 'acp-edit', configured[idx].id);
      });
    });

    // Delete individual
    this.overlay.querySelectorAll('.acp-btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id!;
        await agentConfigService.deleteAgent(id);
        this.refresh();
      });
    });

    // Delete all
    this.overlay.querySelector('.acp-btn-delete-all')?.addEventListener('click', async () => {
      await agentConfigService.deleteAllAgents();
      this.refresh();
    });

    this.bindToolMappings();
  }

  private bindToolMappings(): void {
    if (!this.overlay) return;

    // Add tool
    this.overlay.querySelectorAll('.acp-tool-add-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const agentId = (btn as HTMLElement).dataset.agent!;
        const section = btn.closest('.acp-tool-add')!;
        const select = section.querySelector('.acp-tool-add-select') as HTMLSelectElement;
        const custom = section.querySelector('.acp-tool-add-custom') as HTMLInputElement;

        const toolName = select.value || custom.value.trim();
        if (!toolName) return;

        const allTools = agentConfigService.getToolsForAgent(agentId);
        const known = allTools.find(t => t.name === toolName);
        const label = known?.label ?? toolName;

        await agentConfigService.saveToolMapping(agentId, toolName, label);
        this.refresh();
      });
    });

    // Update tool mapping — dropdown value is "TYPE:X:Y" or ""
    this.overlay.querySelectorAll('.acp-tool-update').forEach(btn => {
      btn.addEventListener('click', async () => {
        const el = btn as HTMLElement;
        const agentId = el.dataset.agent!;
        const toolName = el.dataset.tool!;
        const label = el.dataset.label!;
        const row = btn.closest('.acp-tool-row')!;

        const rawValue = (row.querySelector('.acp-tool-element') as HTMLSelectElement).value;
        let tileType: string | null = null;
        let targetX: number | null = null;
        let targetY: number | null = null;

        if (rawValue) {
          const [type, x, y] = rawValue.split(':');
          tileType = type;
          targetX = parseInt(x);
          targetY = parseInt(y);
        }

        await agentConfigService.saveToolMapping(agentId, toolName, label, tileType, targetX, targetY);
        this.refresh();
      });
    });

    // Delete tool mapping
    this.overlay.querySelectorAll('.acp-tool-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const el = btn as HTMLElement;
        await agentConfigService.deleteToolMapping(el.dataset.agent!, el.dataset.tool!);
        this.refresh();
      });
    });
  }

  private bindColorPreviews(): void {
    if (!this.overlay) return;

    for (const prefix of ['acp-new', 'acp-edit']) {
      this.overlay.querySelectorAll(`.${prefix}-input-body-color`).forEach(input => {
        input.addEventListener('input', (e) => {
          const container = (e.target as HTMLElement).closest('.acp-skill-row, .acp-agent-row');
          const avatar = container?.querySelector('.acp-preview-avatar') as HTMLElement;
          if (avatar) avatar.style.background = (e.target as HTMLInputElement).value;
        });
      });
      this.overlay.querySelectorAll(`.${prefix}-input-hair-color`).forEach(input => {
        input.addEventListener('input', (e) => {
          const container = (e.target as HTMLElement).closest('.acp-skill-row, .acp-agent-row');
          const hair = container?.querySelector('.acp-skill-form .acp-preview-hair, .acp-agent-edit .acp-preview-hair') as HTMLElement;
          if (hair) hair.style.background = (e.target as HTMLInputElement).value;
        });
      });
    }
  }

  // ── Actions ───────────────────────────────────────────────────

  private async saveNewSkill(u: UnconfiguredSkill, idx: number): Promise<void> {
    const row = this.overlay?.querySelector(`.acp-skill-row[data-index="${idx}"]`);
    if (!row) return;

    const vals = this.readForm(row, 'acp-new');
    await agentConfigService.saveAgent({
      id: agentConfigService.sanitizeId(u.skill.id),
      name: vals.name || u.suggested.name,
      skillId: u.skill.id,
      bodyColor: vals.bodyColor,
      hairColor: vals.hairColor,
      homeX: vals.homeX,
      homeY: vals.homeY,
      zone: vals.zone,
      brainNames: u.suggested.brainNames,
      avatarSeed: u.skill.id,
    });

    this.refresh();
  }

  private async saveEditedAgent(agent: AgentRow, idx: number): Promise<void> {
    const row = this.overlay?.querySelector(`.acp-agent-row[data-index="${idx}"]`);
    if (!row) return;

    const vals = this.readForm(row, 'acp-edit');
    await agentConfigService.saveAgent({
      id: agent.id,
      name: vals.name || agent.name,
      skillId: agent.skill_id,
      bodyColor: vals.bodyColor,
      hairColor: vals.hairColor,
      homeX: vals.homeX,
      homeY: vals.homeY,
      zone: vals.zone,
      brainNames: JSON.parse(agent.brain_names),
      avatarSeed: agent.avatar_seed ?? undefined,
    });

    this.refresh();
  }

  private readForm(container: Element, prefix: string): {
    name: string; zone: string; bodyColor: string; hairColor: string; homeX: number; homeY: number;
  } {
    return {
      name: (container.querySelector(`.${prefix}-input-name`) as HTMLInputElement).value.trim(),
      zone: (container.querySelector(`.${prefix}-input-zone`) as HTMLSelectElement).value,
      bodyColor: (container.querySelector(`.${prefix}-input-body-color`) as HTMLInputElement).value,
      hairColor: (container.querySelector(`.${prefix}-input-hair-color`) as HTMLInputElement).value,
      homeX: parseInt((container.querySelector(`.${prefix}-input-x`) as HTMLInputElement).value),
      homeY: parseInt((container.querySelector(`.${prefix}-input-y`) as HTMLInputElement).value),
    };
  }

  private randomizeForm(container: Element, prefix: string, seed: string): void {
    const colors = generateColors(seed + '-' + Date.now());

    const configured = agentConfigService.getConfiguredAgents();
    const occupied = new Set(configured.map(a => `${a.home_x},${a.home_y}`));
    const zone = (container.querySelector(`.${prefix}-input-zone`) as HTMLSelectElement).value;
    const pos = findFreePosition(zone, occupied);

    (container.querySelector(`.${prefix}-input-body-color`) as HTMLInputElement).value = colors.bodyColor;
    (container.querySelector(`.${prefix}-input-hair-color`) as HTMLInputElement).value = colors.hairColor;
    (container.querySelector(`.${prefix}-input-x`) as HTMLInputElement).value = String(pos.x);
    (container.querySelector(`.${prefix}-input-y`) as HTMLInputElement).value = String(pos.y);

    const form = container.querySelector(`.${prefix === 'acp-new' ? 'acp-skill-form' : 'acp-agent-edit'}`) ?? container;
    const avatar = form.querySelector('.acp-preview-avatar') as HTMLElement;
    const hair = form.querySelector('.acp-preview-hair') as HTMLElement;
    if (avatar) avatar.style.background = colors.bodyColor;
    if (hair) hair.style.background = colors.hairColor;
  }

  private async refresh(): Promise<void> {
    this.hide();
    await this.show();
  }

  private esc(s: string): string {
    const el = document.createElement('span');
    el.textContent = s;
    return el.innerHTML;
  }
}

export const agentConfigPanel = new AgentConfigPanel();
