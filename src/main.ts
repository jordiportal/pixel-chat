import { createGame } from './game/GameConfig';
import { ChatPanel } from './chat/ChatPanel';
import { BrainClient } from './brain/client';
import { eventBus } from './events/EventBus';
import { AGENT_DEFS } from './game/map/OfficeMap';

/* ─── Bootstrap ─── */

const game = createGame('game-container');
const chat = new ChatPanel('chat-container');
const brain = new BrainClient();

/* ─── Status Bar ─── */

const statusBar = document.getElementById('status-bar')!;
const agentStatuses = new Map<string, HTMLElement>();

for (const def of AGENT_DEFS) {
  const el = document.createElement('div');
  el.className = 'agent-status';
  el.innerHTML = `
    <span class="agent-dot" style="background:${def.bodyColor}"></span>
    <span class="agent-name">${def.name}</span>
    <span class="agent-action">Idle</span>
  `;
  statusBar.appendChild(el);
  agentStatuses.set(def.id, el);
}

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

// Suppress unused variable warnings
void game;
void chat;
void brain;
