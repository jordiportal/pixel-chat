import { createGame } from './game/GameConfig';
import { ChatPanel } from './chat/ChatPanel';
import { BrainClient } from './brain/client';
import { eventBus } from './events/EventBus';
import { agentRegistry } from './game/map/AgentRegistry';
import { agentConfigService } from './services/AgentConfigService';
import { db } from './db/Database';
import { tileRegistry } from './services/TileRegistry';
import { agentCard } from './ui/AgentCard';
import type { AgentDef } from './game/map/OfficeMap';

/* ─── Status Bar (Dynamic) ─── */

const statusBar = document.getElementById('status-bar')!;
const agentStatuses = new Map<string, HTMLElement>();

function clearAgentStatuses(): void {
  statusBar.innerHTML = '';
  agentStatuses.clear();
}

function renderAgentStatuses(agents: AgentDef[]): void {
  clearAgentStatuses();
  for (const def of agents) {
    if (agentStatuses.has(def.id)) continue;
    const el = document.createElement('div');
    el.className = 'agent-status';
    el.setAttribute('data-agent-id', def.id);
    el.innerHTML = `
      <span class="agent-dot" style="background:${def.bodyColor}"></span>
      <span class="agent-name">${def.name}</span>
      <span class="agent-action">Idle</span>
    `;
    statusBar.appendChild(el);
    agentStatuses.set(def.id, el);
  }

  if (agents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'agent-status agent-status-empty';
    empty.innerHTML = '<span class="agent-action">Sin agentes — abre el <a href="editor.html" style="color:#4488cc">Editor</a></span>';
    statusBar.appendChild(empty);
  }
}

eventBus.on('agents:loaded', (payload: { agents: AgentDef[]; source: string }) => {
  console.log(`[Main] Reloading status bar with ${payload.agents.length} agents from ${payload.source}`);
  currentAgentDefs = payload.agents;
  renderAgentStatuses(payload.agents);
});

eventBus.on('agent:status', (payload: {
  id: string; name: string; color: string; action: string; active: boolean;
}) => {
  const el = agentStatuses.get(payload.id);
  if (!el) return;
  const dot = el.querySelector('.agent-dot') as HTMLElement;
  const actionEl = el.querySelector('.agent-action') as HTMLElement;
  dot.classList.toggle('active', payload.active);
  actionEl.textContent = payload.action;
});

/* ─── Agent Card ─── */

let currentAgentDefs: AgentDef[] = [];

eventBus.on('agent:card-open', (data: { def: AgentDef; state: string; action: string; tileX: number; tileY: number }) => {
  agentCard.show(data as any);
});

statusBar.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('.agent-status');
  if (!el || el.classList.contains('agent-status-empty')) return;
  const agentId = el.getAttribute('data-agent-id');
  if (!agentId) return;
  const def = currentAgentDefs.find(a => a.id === agentId);
  if (!def) return;
  agentCard.show({ def, state: 'idle' as any, action: 'Idle', tileX: def.homeX, tileY: def.homeY });
});

/* ─── Camera HUD ─── */

function createCameraHUD(): void {
  const container = document.getElementById('game-container')!;

  const hud = document.createElement('div');
  hud.className = 'camera-hud';

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'camera-zoom-label';
  zoomLabel.textContent = '100%';

  const btnZoomIn = document.createElement('button');
  btnZoomIn.className = 'camera-btn';
  btnZoomIn.textContent = '+';
  btnZoomIn.title = 'Zoom in';
  btnZoomIn.addEventListener('click', () => eventBus.emit('camera:zoom-in'));

  const btnZoomOut = document.createElement('button');
  btnZoomOut.className = 'camera-btn';
  btnZoomOut.textContent = '−';
  btnZoomOut.title = 'Zoom out';
  btnZoomOut.addEventListener('click', () => eventBus.emit('camera:zoom-out'));

  const btnFitAll = document.createElement('button');
  btnFitAll.className = 'camera-btn camera-btn-wide';
  btnFitAll.textContent = '⊞';
  btnFitAll.title = 'Ver todo el mapa';
  btnFitAll.addEventListener('click', () => eventBus.emit('camera:fit-all'));

  const btnFollow = document.createElement('button');
  btnFollow.className = 'camera-btn camera-btn-wide camera-btn-active';
  btnFollow.textContent = '◎';
  btnFollow.title = 'Seguir agente';
  btnFollow.addEventListener('click', () => eventBus.emit('camera:follow-agent'));

  hud.append(btnZoomOut, zoomLabel, btnZoomIn, btnFitAll, btnFollow);
  container.appendChild(hud);

  eventBus.on('camera:zoom-changed', (zoom: number) => {
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  });

  eventBus.on('camera:follow-changed', (following: boolean) => {
    btnFollow.classList.toggle('camera-btn-active', following);
  });
}

/* ─── Bootstrap: DB first, then Phaser ─── */

async function boot(): Promise<void> {
  await db.init();
  await tileRegistry.load();
  console.log('[Main] Database + TileRegistry initialized');

  const game = createGame('game-container');
  createCameraHUD();
  const chat = new ChatPanel('chat-container');
  const brain = new BrainClient();

  currentAgentDefs = agentRegistry.getAgents();
  renderAgentStatuses(currentAgentDefs);

  if (agentConfigService.hasAgents()) {
    await agentConfigService.redistributeAgents();
    const agents = agentConfigService.getAgentDefs();
    console.log(`[Main] Loaded ${agents.length} configured agents from DB`);
    eventBus.emit('agents:loaded', { agents, source: 'db' });
  }

  try {
    const skills = await agentConfigService.fetchSkills();
    console.log(`[Main] Discovered ${skills.length} A2A skills`);

    const unconfigured = await agentConfigService.getUnconfiguredSkills();
    if (unconfigured.length > 0) {
      console.log(`[Main] ${unconfigured.length} skills pending configuration`);
      eventBus.emit('agents:pending', { count: unconfigured.length });
    }
  } catch (err) {
    console.warn('[Main] A2A discovery failed:', err);
  }

  void game;
  void chat;
  void brain;
}

boot().catch(err => console.error('[Main] Boot failed:', err));
