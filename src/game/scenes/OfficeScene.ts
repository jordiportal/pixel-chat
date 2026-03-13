import Phaser from 'phaser';
import {
  parseMapData, TILE_SIZE, MAP_COLS, MAP_ROWS,
  ZONES, ACTION_TYPE_TO_ZONE,
  type AgentDef,
} from '../map/OfficeMap';
import { Agent } from '../entities/Agent';
import { eventBus } from '../../events/EventBus';
import { agentRegistry } from '../map/AgentRegistry';
import { agentConfigService } from '../../services/AgentConfigService';
import { buildAgentTextures } from './PreloadScene';
import type { BrainThinkingEvent, BrainActionEvent, BrainStatusEvent } from '../../brain/types';

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, Agent> = new Map();
  private mapData: number[][] = [];
  private activeAgentId = '';
  private activeDelegations: Map<string, string> = new Map();
  private currentAgentDefs: AgentDef[] = [];

  constructor() {
    super('OfficeScene');
  }

  create(): void {
    this.mapData = parseMapData();
    this.createTilemap();

    this.currentAgentDefs = agentRegistry.getAgents();
    this.createAgents();

    this.setupCamera();
    this.listenBrainEvents();
    this.listenAgentChanges();
    this.addZoneLabels();
  }

  update(): void {
    for (const agent of this.agents.values()) {
      agent.update();
    }
  }

  /* ─── Tilemap ─── */

  private createTilemap(): void {
    const map = this.make.tilemap({
      data: this.mapData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) {
      console.error('Failed to create tileset');
      return;
    }

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) layer.setDepth(0);
  }

  /* ─── Agents ─── */

  private createAgents(): void {
    for (const agent of this.agents.values()) {
      agent.destroy();
    }
    this.agents.clear();

    for (const def of this.currentAgentDefs) {
      if (!this.textures.exists(`agent-${def.id}`)) {
        buildAgentTextures(this, def);
      }
      const agent = new Agent(this, def, this.mapData);
      this.agents.set(def.id, agent);
    }

    console.log(`[OfficeScene] Created ${this.agents.size} agents`);
  }

  /**
   * Recrea los agentes cuando cambian (ej: tras cargar desde A2A)
   */
  recreateAgents(agentDefs: AgentDef[]): void {
    this.currentAgentDefs = agentDefs;

    // Guardar referencias a agentes activos
    const activeIds = new Set<string>();
    for (const [id, agent] of this.agents) {
      if (agent.active) activeIds.add(id);
    }

    // Recrear agentes
    this.createAgents();

    for (const id of activeIds) {
      const agent = this.agents.get(id);
      if (agent) agent.setActive(true);
    }

    const firstId = this.agents.keys().next().value as string | undefined;
    if (firstId) this.activeAgentId = firstId;
  }

  /* ─── Camera ─── */

  private setupCamera(): void {
    const worldW = MAP_COLS * TILE_SIZE;
    const worldH = MAP_ROWS * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.centerOn(worldW / 2, worldH / 2);
  }

  /* ─── Zone labels ─── */

  private addZoneLabels(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '6px',
      fontFamily: 'monospace',
      color: '#ffffff44',
    };
    for (const z of Object.values(ZONES)) {
      const cx = (z.bounds.x + z.bounds.w / 2) * TILE_SIZE;
      const cy = (z.bounds.y + 1) * TILE_SIZE;
      const label = this.add.text(cx, cy, z.label, style);
      label.setOrigin(0.5, 0);
      label.setDepth(1);
    }
  }

  /* ─── Brain Events ─── */

  private listenBrainEvents(): void {
    eventBus.on('brain:thinking', (ev: BrainThinkingEvent) => {
      const agent = this.getActiveAgent();
      if (ev.status === 'start' || ev.status === 'progress') {
        agent.showThinking(ev.content);
      } else {
        agent.stopAction();
      }
      this.emitAgentStatus(agent, 'Pensando...');
    });

    eventBus.on('brain:action', (ev: BrainActionEvent) => {
      this.handleAction(ev);
    });

    eventBus.on('brain:status', (ev: BrainStatusEvent) => {
      if (ev.iteration && ev.max_iterations) {
        const agent = this.getActiveAgent();
        this.emitAgentStatus(agent, `Paso ${ev.iteration}/${ev.max_iterations}`);
      }
    });

    eventBus.on('chat:response-start', () => {
      const first = this.agents.values().next().value as Agent | undefined;
      if (!first) return;
      first.setActive(true);
      first.showThinking();
      this.activeAgentId = first.def.id;
      this.emitAgentStatus(first, 'Procesando...');
    });

    eventBus.on('chat:response-end', () => {
      const firstId = this.agents.keys().next().value as string | undefined;
      for (const agent of this.agents.values()) {
        agent.stopAction();
        agent.goHome();
        if (agent.def.id !== firstId) agent.setActive(false);
      }
      this.activeAgentId = firstId ?? '';
      this.activeDelegations.clear();
      const first = firstId ? this.agents.get(firstId) : undefined;
      if (first) this.emitAgentStatus(first, 'Idle');
    });
  }

  private async handleAction(ev: BrainActionEvent): Promise<void> {
    if (ev.action_type === 'delegate' && ev.status === 'running') {
      this.handleDelegation(ev);
      return;
    }

    if (ev.action_type === 'delegate' && ev.status === 'completed') {
      this.handleDelegationComplete(ev);
      return;
    }

    const agent = this.getActiveAgent();

    if (ev.status === 'running') {
      agent.showSpeech(ev.title || ev.action_type);
      this.emitAgentStatus(agent, ev.title || ev.action_type);

      const toolTarget = agentConfigService.resolveToolTarget(agent.def.id, ev.action_type);
      if (toolTarget) {
        await agent.walkTo(toolTarget.x, toolTarget.y);
      } else {
        const zoneName = ACTION_TYPE_TO_ZONE[ev.action_type] ?? 'mainOffice';
        const zone = ZONES[zoneName];
        if (zone) await agent.walkTo(zone.poi.x, zone.poi.y);
      }

      agent.startWorking();
    } else if (ev.status === 'completed') {
      agent.stopAction();
      const summary = ev.results_summary || ev.title || 'Completado';
      agent.showSpeech(`✓ ${summary}`);
      this.emitAgentStatus(agent, `✓ ${summary}`);
    }
  }

  private handleDelegation(ev: BrainActionEvent): void {
    const specialist = this.findSpecialist(ev.agent_name);
    if (!specialist) return;

    specialist.setActive(true);

    const prevId = this.activeAgentId;
    this.activeAgentId = specialist.def.id;

    if (ev.delegation_id) {
      this.activeDelegations.set(ev.delegation_id, specialist.def.id);
    }

    const delegator = this.agents.get(prevId);
    if (delegator) {
      delegator.showSpeech(`→ ${specialist.def.name}`);
      this.emitAgentStatus(delegator, `Delega a ${specialist.def.name}`);
    }
    this.emitAgentStatus(specialist, ev.title || 'Iniciando...');

    specialist.showSpeech(ev.title || '¡En ello!');
  }

  private handleDelegationComplete(ev: BrainActionEvent): void {
    let agentId: string | undefined;
    if (ev.delegation_id) {
      agentId = this.activeDelegations.get(ev.delegation_id);
      this.activeDelegations.delete(ev.delegation_id);
    }

    const specialist = agentId
      ? this.agents.get(agentId)
      : this.findSpecialist(ev.agent_name);

    if (specialist) {
      specialist.showSpeech('✓ Listo');
      this.emitAgentStatus(specialist, '✓ Completado');

      this.time.delayedCall(1200, () => {
        specialist.stopAction();
        specialist.goHome();
        specialist.setActive(false);
      });
    }

    const firstId = this.agents.keys().next().value as string | undefined;
    this.activeAgentId = firstId ?? '';
    const primary = firstId ? this.agents.get(firstId) : undefined;
    if (primary) {
      primary.showSpeech('Recibido');
      this.emitAgentStatus(primary, 'Procesando respuesta...');
    }
  }

  /* ─── Helpers ─── */

  private getActiveAgent(): Agent {
    return this.agents.get(this.activeAgentId) ?? this.agents.values().next().value as Agent;
  }

  private findSpecialist(brainName?: string): Agent | undefined {
    if (!brainName) return undefined;

    const lower = brainName.toLowerCase();
    for (const agent of this.agents.values()) {
      if (agent.def.brainNames.some(n => lower.includes(n))) return agent;
    }

    // Si no se encuentra, buscar en el registry (podría ser un agente nuevo)
    const fromRegistry = agentRegistry.findByBrainName(brainName);
    if (fromRegistry && this.agents.has(fromRegistry.id)) {
      return this.agents.get(fromRegistry.id);
    }

    return undefined;
  }

  /* ─── Agent Registry Events ─── */

  private listenAgentChanges(): void {
    eventBus.on('agents:loaded', (payload: { agents: AgentDef[]; source: string }) => {
      console.log(`[OfficeScene] Agents reloaded from ${payload.source}, count: ${payload.agents.length}`);
      this.recreateAgents(payload.agents);
    });
  }

  private emitAgentStatus(agent: Agent, action: string): void {
    eventBus.emit('agent:status', {
      id: agent.def.id,
      name: agent.def.name,
      color: agent.def.bodyColor,
      action,
      active: agent.active,
    });
  }
}
