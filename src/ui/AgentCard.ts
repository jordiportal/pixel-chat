import type { AgentDef } from '../game/map/OfficeMap';
import { TILE_SIZE } from '../game/map/OfficeMap';
import { db } from '../db/Database';
import { eventBus } from '../events/EventBus';
import { drawTile } from '../game/scenes/PreloadScene';
import { agentConfigService } from '../services/AgentConfigService';

type AgentLiveState = 'idle' | 'walking' | 'working' | 'thinking';

interface AgentCardData {
  def: AgentDef;
  state: AgentLiveState;
  action: string;
  tileX: number;
  tileY: number;
}

const STATE_LABELS: Record<AgentLiveState, string> = {
  idle: 'En reposo',
  walking: 'Caminando',
  working: 'Trabajando',
  thinking: 'Pensando',
};

const STATE_COLORS: Record<AgentLiveState, string> = {
  idle: '#4aaa4a',
  walking: '#ddaa33',
  working: '#e94560',
  thinking: '#4488cc',
};

class AgentCardManager {
  private overlay: HTMLElement | null = null;
  private currentAgentId: string | null = null;
  private liveStates = new Map<string, { state: AgentLiveState; action: string; tileX: number; tileY: number }>();

  constructor() {
    eventBus.on('agent:status', (p: { id: string; action: string; active: boolean }) => {
      const s = this.liveStates.get(p.id);
      if (s) {
        s.action = p.action;
        if (this.currentAgentId === p.id) this.updateLiveSection(p.id);
      }
    });

    eventBus.on('agent:state-changed', (p: { id: string; state: AgentLiveState; tileX: number; tileY: number }) => {
      let s = this.liveStates.get(p.id);
      if (!s) {
        s = { state: 'idle', action: 'Idle', tileX: p.tileX, tileY: p.tileY };
        this.liveStates.set(p.id, s);
      }
      s.state = p.state;
      s.tileX = p.tileX;
      s.tileY = p.tileY;
      if (this.currentAgentId === p.id) this.updateLiveSection(p.id);
    });
  }

  show(data: AgentCardData): void {
    this.close();
    this.currentAgentId = data.def.id;
    this.liveStates.set(data.def.id, {
      state: data.state,
      action: data.action,
      tileX: data.tileX,
      tileY: data.tileY,
    });

    const overlay = document.createElement('div');
    overlay.className = 'rpg-card-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    overlay.innerHTML = this.renderCard(data);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.renderAvatar(data.def);
    this.renderToolIcons(data.def.id);

    overlay.querySelector('.rpg-close')?.addEventListener('click', () => this.close());

    overlay.querySelector('.rpg-set-primary')?.addEventListener('click', () => {
      eventBus.emit('agent:set-primary', data.def.id);
      this.updatePrimaryButton(data.def.id);
    });

    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  close(): void {
    if (!this.overlay) return;
    this.overlay.classList.remove('visible');
    const el = this.overlay;
    setTimeout(() => el.remove(), 200);
    this.overlay = null;
    this.currentAgentId = null;
  }

  private renderCard(data: AgentCardData): string {
    const { def } = data;
    const live = this.liveStates.get(def.id)!;
    const tools = db.getToolMappingsForAgent(def.id);
    const agentRow = db.getAgent(def.id);
    const brainNames = def.brainNames.length > 0 ? def.brainNames.join(', ') : '—';
    const skillId = agentRow?.skill_id || '—';

    const skill = agentRow
      ? agentConfigService.getSkills().find(s => s.id === agentRow.skill_id)
      : undefined;

    const isPrimary = localStorage.getItem('pixel-chat:primary-agent') === def.id;

    const description = skill?.description || '';
    const tags = skill?.tags ?? [];
    const examples = skill?.examples ?? [];
    const inputModes = skill?.inputModes ?? [];
    const outputModes = skill?.outputModes ?? [];

    return `
      <div class="rpg-card">
        <button class="rpg-close">✕</button>

        <div class="rpg-header">
          <canvas class="rpg-avatar" width="${TILE_SIZE}" height="${TILE_SIZE}"></canvas>
          <div class="rpg-title">
            <h2 class="rpg-name">${def.name}</h2>
            <span class="rpg-class">${skillId}</span>
          </div>
          <button class="rpg-set-primary${isPrimary ? ' is-primary' : ''}" title="${isPrimary ? 'Agente principal' : 'Hacer principal'}">
            ${isPrimary ? '★' : '☆'}
          </button>
        </div>

        ${description ? `
          <div class="rpg-divider"></div>
          <div class="rpg-section">
            <p class="rpg-description">${this.escapeHtml(description)}</p>
          </div>
        ` : ''}

        <div class="rpg-divider"></div>

        <div class="rpg-stats" data-agent-live="${def.id}">
          <div class="rpg-stat-row">
            <span class="rpg-stat-label">Estado</span>
            <span class="rpg-stat-value rpg-state" style="color:${STATE_COLORS[live.state]}">${STATE_LABELS[live.state]}</span>
          </div>
          <div class="rpg-stat-row">
            <span class="rpg-stat-label">Acción</span>
            <span class="rpg-stat-value rpg-action">${live.action}</span>
          </div>
          <div class="rpg-stat-row">
            <span class="rpg-stat-label">Posición</span>
            <span class="rpg-stat-value rpg-pos">(${live.tileX}, ${live.tileY})</span>
          </div>
        </div>

        <div class="rpg-divider"></div>

        <div class="rpg-section">
          <h3 class="rpg-section-title">Atributos</h3>
          <div class="rpg-attributes">
            <div class="rpg-attr">
              <span class="rpg-attr-label">Zona</span>
              <span class="rpg-attr-value">${def.zone}</span>
            </div>
            <div class="rpg-attr">
              <span class="rpg-attr-label">Base</span>
              <span class="rpg-attr-value">(${def.homeX}, ${def.homeY})</span>
            </div>
            <div class="rpg-attr">
              <span class="rpg-attr-label">Aliases</span>
              <span class="rpg-attr-value">${brainNames}</span>
            </div>
          </div>
        </div>

        ${tags.length > 0 ? `
          <div class="rpg-divider"></div>
          <div class="rpg-section">
            <h3 class="rpg-section-title">Tags <span class="rpg-badge">${tags.length}</span></h3>
            <div class="rpg-tags">
              ${tags.map(t => `<span class="rpg-tag">${this.escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${(inputModes.length > 0 || outputModes.length > 0) ? `
          <div class="rpg-divider"></div>
          <div class="rpg-section">
            <h3 class="rpg-section-title">Modos I/O</h3>
            <div class="rpg-modes">
              ${inputModes.map(m => `<span class="rpg-mode rpg-mode-in">↓ ${this.escapeHtml(m)}</span>`).join('')}
              ${outputModes.map(m => `<span class="rpg-mode rpg-mode-out">↑ ${this.escapeHtml(m)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="rpg-divider"></div>

        <div class="rpg-section">
          <h3 class="rpg-section-title">Apariencia</h3>
          <div class="rpg-colors">
            <div class="rpg-color-swatch" style="background:${def.bodyColor}"></div>
            <span>Cuerpo</span>
            <div class="rpg-color-swatch" style="background:${def.hairColor}"></div>
            <span>Pelo</span>
          </div>
        </div>

        <div class="rpg-divider"></div>

        <div class="rpg-section">
          <h3 class="rpg-section-title">Habilidades <span class="rpg-badge">${tools.length}</span></h3>
          <div class="rpg-tools" data-agent-tools="${def.id}">
            ${tools.length === 0
              ? '<span class="rpg-empty">Sin herramientas asignadas</span>'
              : tools.map(t => `
                <div class="rpg-tool">
                  <canvas class="rpg-tool-icon" width="${TILE_SIZE}" height="${TILE_SIZE}" data-tile-type="${t.tile_type || ''}"></canvas>
                  <div class="rpg-tool-info">
                    <span class="rpg-tool-name">${t.tool_name}</span>
                    <span class="rpg-tool-label">${t.label}</span>
                    ${t.target_x != null ? `<span class="rpg-tool-pos">→ (${t.target_x}, ${t.target_y})</span>` : ''}
                  </div>
                </div>
              `).join('')
            }
          </div>
        </div>

        ${examples.length > 0 ? `
          <div class="rpg-divider"></div>
          <div class="rpg-section">
            <h3 class="rpg-section-title">Ejemplos</h3>
            <div class="rpg-examples">
              ${examples.map(ex => `<div class="rpg-example">"${this.escapeHtml(ex)}"</div>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private renderAvatar(def: AgentDef): void {
    const canvas = this.overlay?.querySelector('.rpg-avatar') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = def.bodyColor;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const F = TILE_SIZE / 16;
    const skin = '#f0c890';
    const p = (cx: number, cy: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(cx * F, cy * F, w * F, h * F);
    };
    p(5, 0, 6, 3, def.hairColor);
    p(5, 3, 6, 3, skin);
    p(6, 4, 1, 1, '#1a1a2e');
    p(9, 4, 1, 1, '#1a1a2e');
    p(4, 6, 8, 4, def.bodyColor);
    p(5, 10, 6, 2, '#384058');
    p(5, 12, 2, 2, '#28282e');
    p(9, 12, 2, 2, '#28282e');
  }

  private renderToolIcons(agentId: string): void {
    const container = this.overlay?.querySelector(`[data-agent-tools="${agentId}"]`);
    if (!container) return;
    container.querySelectorAll('.rpg-tool-icon').forEach((canvas) => {
      const el = canvas as HTMLCanvasElement;
      const tileType = el.dataset.tileType;
      if (!tileType) return;
      const ctx = el.getContext('2d')!;
      const tileId = parseInt(tileType);
      if (!isNaN(tileId)) {
        drawTile(ctx, 0, tileId);
      }
    });
  }

  private updatePrimaryButton(agentId: string): void {
    if (!this.overlay) return;
    const btn = this.overlay.querySelector('.rpg-set-primary') as HTMLElement | null;
    if (!btn) return;
    btn.classList.add('is-primary');
    btn.textContent = '★';
    btn.title = 'Agente principal';
  }

  private updateLiveSection(agentId: string): void {
    if (!this.overlay) return;
    const section = this.overlay.querySelector(`[data-agent-live="${agentId}"]`);
    if (!section) return;
    const live = this.liveStates.get(agentId);
    if (!live) return;

    const stateEl = section.querySelector('.rpg-state') as HTMLElement | null;
    const actionEl = section.querySelector('.rpg-action') as HTMLElement | null;
    const posEl = section.querySelector('.rpg-pos') as HTMLElement | null;

    if (stateEl) {
      stateEl.textContent = STATE_LABELS[live.state];
      stateEl.style.color = STATE_COLORS[live.state];
    }
    if (actionEl) actionEl.textContent = live.action;
    if (posEl) posEl.textContent = `(${live.tileX}, ${live.tileY})`;
  }
}

export const agentCard = new AgentCardManager();
