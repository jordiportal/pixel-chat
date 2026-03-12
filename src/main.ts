import { createGame } from './game/GameConfig';
import { ChatPanel } from './chat/ChatPanel';
import { BrainClient } from './brain/client';
import { eventBus } from './events/EventBus';
import { agentRegistry } from './game/map/AgentRegistry';
import { agentConfigService } from './services/AgentConfigService';
import { agentConfigPanel } from './ui/AgentConfigPanel';
import { db } from './db/Database';
import type { AgentDef } from './game/map/OfficeMap';

/* ─── Bootstrap ─── */

const game = createGame('game-container');
const chat = new ChatPanel('chat-container');
const brain = new BrainClient();

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
    empty.innerHTML = '<span class="agent-action">Sin agentes — configura desde el chat</span>';
    statusBar.appendChild(empty);
  }
}

renderAgentStatuses(agentRegistry.getAgents());

eventBus.on('agents:loaded', (payload: { agents: AgentDef[]; source: string }) => {
  console.log(`[Main] Reloading status bar with ${payload.agents.length} agents from ${payload.source}`);
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

/* ─── Hybrid init: DB → A2A → load or prompt ─── */

async function initAgents(): Promise<void> {
  await db.init();
  console.log('[Main] Database initialized');

  // If we already have configured agents, load them immediately
  if (agentConfigService.hasAgents()) {
    const agents = agentConfigService.getAgentDefs();
    console.log(`[Main] Loaded ${agents.length} configured agents from DB`);
    eventBus.emit('agents:loaded', { agents, source: 'db' });
  }

  // Discover A2A skills in background
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
}

initAgents().catch(err => console.error('[Main] Agent init failed:', err));

// Global access for config panel
eventBus.on('open:agent-config', () => {
  agentConfigPanel.show();
});

void game;
void chat;
void brain;
