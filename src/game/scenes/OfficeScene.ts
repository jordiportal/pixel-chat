import Phaser from 'phaser';
import {
  parseMapData, TILE_SIZE, MAP_COLS, MAP_ROWS,
  getZones, ACTION_TYPE_TO_ZONE, getWalkableSet,
  type AgentDef,
} from '../map/OfficeMap';
import { Agent } from '../entities/Agent';
import { eventBus } from '../../events/EventBus';
import { agentRegistry } from '../map/AgentRegistry';
import { agentConfigService } from '../../services/AgentConfigService';
import { buildAgentTextures } from './PreloadScene';
import type {
  BrainThinkingEvent, BrainActionEvent, BrainStatusEvent,
  BrainSourcesEvent, BrainArtifactEvent,
} from '../../brain/types';
import { ParticleFX } from '../fx/Particles';
import { DelegationLines } from '../fx/DelegationLines';
import { TileEffects } from '../fx/TileEffects';
import { SourceCards } from '../ui/SourceCards';
import { PlanBoard } from '../ui/PlanBoard';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.15;
const PAN_SPEED = 8;

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, Agent> = new Map();
  private mapData: number[][] = [];
  private activeAgentId = '';
  private activeDelegations: Map<string, string> = new Map();
  private currentAgentDefs: AgentDef[] = [];
  private fx!: ParticleFX;
  private delegationLines!: DelegationLines;
  private tileEffects!: TileEffects;
  private sourceCards!: SourceCards;
  private planBoard!: PlanBoard;
  private cameraFollowing = true;
  private isDragging = false;
  private dragPrevX = 0;
  private dragPrevY = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  constructor() {
    super('OfficeScene');
  }

  create(): void {
    this.mapData = parseMapData();
    this.createTilemap();

    this.currentAgentDefs = agentRegistry.getAgents();
    this.createAgents();

    this.fx = new ParticleFX(this);
    this.delegationLines = new DelegationLines(this);
    this.tileEffects = new TileEffects(this, this.mapData);
    this.sourceCards = new SourceCards(this);
    this.planBoard = new PlanBoard(this);

    this.setupCamera();
    this.setupCameraControls();
    this.listenBrainEvents();
    this.listenAgentChanges();
    this.addZoneLabels();
  }

  private lastAgentState = new Map<string, string>();

  update(): void {
    for (const agent of this.agents.values()) {
      agent.update();
      const key = `${agent.state}:${agent.tileX}:${agent.tileY}`;
      if (this.lastAgentState.get(agent.def.id) !== key) {
        this.lastAgentState.set(agent.def.id, key);
        eventBus.emit('agent:state-changed', {
          id: agent.def.id,
          state: agent.state,
          tileX: agent.tileX,
          tileY: agent.tileY,
        });
      }
    }
    this.delegationLines.update(this.agents);
    this.updateCameraPan();
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

    const primaryId = this.detectPrimaryId();
    this.activeAgentId = primaryId;
    for (const [id, agent] of this.agents) {
      agent.setActive(id === primaryId);
    }

    console.log(`[OfficeScene] Created ${this.agents.size} agents, primary: ${primaryId}`);
  }

  /**
   * Recrea los agentes cuando cambian (ej: tras cargar desde A2A)
   */
  recreateAgents(agentDefs: AgentDef[]): void {
    this.currentAgentDefs = agentDefs;
    this.createAgents();
    this.followActiveAgent();
  }

  /* ─── Camera ─── */

  private setupCamera(): void {
    const worldW = MAP_COLS * TILE_SIZE;
    const worldH = MAP_ROWS * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.centerOn(worldW / 2, worldH / 2);
    this.followActiveAgent();
  }

  private followActiveAgent(): void {
    const agent = this.agents.get(this.activeAgentId)
      ?? this.agents.values().next().value as Agent | undefined;
    if (agent) {
      this.cameraFollowing = true;
      this.cameras.main.startFollow(agent.sprite, true, 0.08, 0.08);
      eventBus.emit('camera:follow-changed', true);
    }
  }

  /* ─── Camera controls ─── */

  private setupCameraControls(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: any, _dx: number, dy: number) => {
      this.zoomCamera(dy > 0 ? -ZOOM_STEP : ZOOM_STEP);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.dragPrevX = pointer.x;
        this.dragPrevY = pointer.y;
        this.isDragging = false;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const dx = pointer.x - this.dragPrevX;
      const dy = pointer.y - this.dragPrevY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!this.isDragging && dist > 4) {
        this.isDragging = true;
        this.stopFollowing();
      }

      if (this.isDragging) {
        const cam = this.cameras.main;
        cam.scrollX -= dx / cam.zoom;
        cam.scrollY -= dy / cam.zoom;
        this.dragPrevX = pointer.x;
        this.dragPrevY = pointer.y;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonReleased() && !this.isDragging) {
        this.handleClick(pointer);
      }
      this.isDragging = false;
    });

    eventBus.on('camera:zoom-in', () => this.zoomCamera(ZOOM_STEP));
    eventBus.on('camera:zoom-out', () => this.zoomCamera(-ZOOM_STEP));
    eventBus.on('camera:fit-all', () => this.fitAll());
    eventBus.on('camera:follow-agent', () => this.resumeFollowing());
  }

  private updateCameraPan(): void {
    if (this.cameraFollowing) return;
    const cam = this.cameras.main;
    const speed = PAN_SPEED / cam.zoom;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx = speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -speed;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy = speed;

    if (dx !== 0 || dy !== 0) {
      cam.scrollX += dx;
      cam.scrollY += dy;
    }
  }

  zoomCamera(delta: number): void {
    const cam = this.cameras.main;
    const newZoom = Phaser.Math.Clamp(cam.zoom + delta, MIN_ZOOM, MAX_ZOOM);
    cam.setZoom(newZoom);
    eventBus.emit('camera:zoom-changed', newZoom);
  }

  private fitAll(): void {
    this.stopFollowing();
    const cam = this.cameras.main;
    const worldW = MAP_COLS * TILE_SIZE;
    const worldH = MAP_ROWS * TILE_SIZE;
    const zoomX = cam.width / worldW;
    const zoomY = cam.height / worldH;
    const zoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY) * 0.95, MIN_ZOOM, MAX_ZOOM);
    cam.setZoom(zoom);
    cam.centerOn(worldW / 2, worldH / 2);
    eventBus.emit('camera:zoom-changed', zoom);
  }

  private stopFollowing(): void {
    if (!this.cameraFollowing) return;
    this.cameraFollowing = false;
    this.cameras.main.stopFollow();
    eventBus.emit('camera:follow-changed', false);
  }

  private resumeFollowing(): void {
    this.cameraFollowing = true;
    this.cameras.main.setZoom(1);
    this.followActiveAgent();
    eventBus.emit('camera:follow-changed', true);
    eventBus.emit('camera:zoom-changed', 1);
  }

  /* ─── Zone labels ─── */

  private addZoneLabels(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: `${Math.round(TILE_SIZE * 0.375)}px`,
      fontFamily: 'monospace',
      color: '#ffffff44',
    };
    for (const z of Object.values(getZones())) {
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
        this.fx.emitThinking(agent.sprite.x, agent.sprite.y);
      } else {
        agent.stopAction();
        this.fx.stopThinking();
      }
      this.emitAgentStatus(agent, 'Pensando...');
    });

    eventBus.on('brain:action', (ev: BrainActionEvent) => {
      this.handleAction(ev);
    });

    eventBus.on('brain:status', (ev: BrainStatusEvent) => {
      if (ev.iteration && ev.max_iterations) {
        const agent = this.getActiveAgent();
        agent.showProgress(ev.iteration, ev.max_iterations);
        this.emitAgentStatus(agent, `Paso ${ev.iteration}/${ev.max_iterations}`);
      }
    });

    eventBus.on('brain:sources', (ev: BrainSourcesEvent) => {
      this.sourceCards.show(ev.sources);
    });

    eventBus.on('brain:artifact', (ev: BrainArtifactEvent) => {
      const agent = this.getActiveAgent();
      this.fx.emitArtifact(agent.sprite.x, agent.sprite.y, ev.artifact_type);
    });

    eventBus.on('chat:response-start', () => {
      const primary = this.getPrimaryAgent();
      if (!primary) return;
      primary.setActive(true);
      primary.showThinking();
      this.activeAgentId = primary.def.id;
      this.followActiveAgent();
      this.emitAgentStatus(primary, 'Procesando...');
    });

    eventBus.on('chat:response-end', () => {
      const primaryId = this.detectPrimaryId();

      for (const agent of this.agents.values()) {
        if (agent.active) agent.celebrate();
      }

      this.time.delayedCall(500, () => {
        for (const agent of this.agents.values()) {
          agent.stopAction();
          agent.goHome();
          if (agent.def.id !== primaryId) agent.setActive(false);
        }
      });

      this.fx.emitCelebration(
        this.getActiveAgent().sprite.x,
        this.getActiveAgent().sprite.y,
      );

      this.activeAgentId = primaryId;
      this.followActiveAgent();
      this.delegationLines.clearAll();
      this.activeDelegations.clear();
      const primary = this.agents.get(primaryId);
      if (primary) this.emitAgentStatus(primary, 'Idle');
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
      this.fx.stopThinking();
      agent.showSpeech(ev.title || ev.action_type);
      this.emitAgentStatus(agent, ev.title || ev.action_type);

      const toolTarget = agentConfigService.resolveToolTarget(agent.def.id, ev.action_type);
      let destX: number;
      let destY: number;

      if (toolTarget) {
        destX = toolTarget.x;
        destY = toolTarget.y;
      } else {
        const zoneName = ACTION_TYPE_TO_ZONE[ev.action_type] ?? 'mainOffice';
        const zone = getZones()[zoneName];
        destX = zone?.poi.x ?? agent.tileX;
        destY = zone?.poi.y ?? agent.tileY;
      }

      await agent.walkTo(destX, destY);
      agent.startWorking(ev.action_type);
      this.fx.emitWorking(agent.sprite.x, agent.sprite.y, ev.action_type);
      this.tileEffects.activate(destX, destY);
    } else if (ev.status === 'completed') {
      this.fx.stopWorking();
      this.tileEffects.deactivateAll();
      agent.stopAction();

      const summary = ev.results_summary || ev.title || 'Completado';
      agent.showSpeech(`✓ ${summary}`);
      this.fx.emitComplete(agent.sprite.x, agent.sprite.y);
      this.emitAgentStatus(agent, `✓ ${summary}`);
    } else if (ev.status === 'error') {
      this.fx.stopWorking();
      this.tileEffects.deactivateAll();
      agent.shakeError();
      this.fx.emitError(agent.sprite.x, agent.sprite.y);
      this.emitAgentStatus(agent, '❌ Error');
    }
  }

  private handleDelegation(ev: BrainActionEvent): void {
    const specialist = this.findSpecialist(ev.agent_name);
    if (!specialist) return;

    specialist.setActive(true);
    specialist.wave();

    const prevId = this.activeAgentId;
    this.activeAgentId = specialist.def.id;
    this.followActiveAgent();

    if (ev.delegation_id) {
      this.activeDelegations.set(ev.delegation_id, specialist.def.id);
    }

    const delegator = this.agents.get(prevId);
    if (delegator) {
      delegator.showSpeech(`→ ${specialist.def.name}`);
      this.emitAgentStatus(delegator, `Delega a ${specialist.def.name}`);
      this.delegationLines.add(prevId, specialist.def.id);
      this.fx.emitDelegation(
        delegator.sprite.x, delegator.sprite.y,
        specialist.sprite.x, specialist.sprite.y,
      );
    }
    this.emitAgentStatus(specialist, ev.title || 'Iniciando...');

    this.time.delayedCall(2000, () => {
      if (specialist.state === 'idle') {
        specialist.showSpeech(ev.title || '¡En ello!');
      }
    });
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
      specialist.celebrate();
      specialist.showSpeech('✓ Listo');
      this.fx.emitComplete(specialist.sprite.x, specialist.sprite.y);
      this.emitAgentStatus(specialist, '✓ Completado');

      const primaryId = this.detectPrimaryId();
      if (primaryId && agentId) {
        this.delegationLines.remove(primaryId, agentId);
      }

      this.time.delayedCall(1200, () => {
        specialist.stopAction();
        specialist.goHome();
        specialist.setActive(false);
      });
    }

    const primaryId = this.detectPrimaryId();
    this.activeAgentId = primaryId;
    this.followActiveAgent();
    const primary = this.agents.get(primaryId);
    if (primary) {
      primary.showSpeech('Recibido');
      this.emitAgentStatus(primary, 'Procesando respuesta...');
    }
  }

  /* ─── Agent click + move ─── */

  private moveMarker: Phaser.GameObjects.Graphics | null = null;
  private moveMarkerTween: Phaser.Tweens.Tween | null = null;

  private handleClick(pointer: Phaser.Input.Pointer): void {
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    for (const agent of this.agents.values()) {
      const s = agent.sprite;
      const halfW = (s.width * s.scaleX) / 2;
      const halfH = (s.height * s.scaleY) / 2;
      if (
        worldX >= s.x - halfW && worldX <= s.x + halfW &&
        worldY >= s.y - halfH && worldY <= s.y + halfH
      ) {
        eventBus.emit('agent:card-open', {
          def: agent.def,
          state: agent.state,
          action: agent.currentActionType || 'Idle',
          tileX: agent.tileX,
          tileY: agent.tileY,
        });
        return;
      }
    }

    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);

    if (tileX < 0 || tileX >= MAP_COLS || tileY < 0 || tileY >= MAP_ROWS) return;

    const tileId = this.mapData[tileY]?.[tileX];
    if (tileId === undefined || !getWalkableSet().has(tileId)) return;

    const primary = this.getPrimaryAgent();
    if (!primary || primary.state === 'working' || primary.state === 'thinking') return;

    this.activeAgentId = primary.def.id;
    this.showMoveMarker(tileX, tileY);
    primary.stopAction();
    this.followActiveAgent();
    primary.walkTo(tileX, tileY).then(() => {
      this.clearMoveMarker();
    });
  }

  private showMoveMarker(tx: number, ty: number): void {
    this.clearMoveMarker();

    const g = this.add.graphics();
    g.setDepth(5);
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = ty * TILE_SIZE + TILE_SIZE / 2;
    const r = TILE_SIZE * 0.35;

    g.lineStyle(2, 0x4488cc, 0.8);
    g.strokeCircle(cx, cy, r);
    g.lineStyle(1, 0x4488cc, 0.4);
    g.strokeCircle(cx, cy, r * 0.5);

    g.fillStyle(0x4488cc, 0.15);
    g.fillCircle(cx, cy, r);

    this.moveMarker = g;
    this.moveMarkerTween = this.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0.3 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private clearMoveMarker(): void {
    this.moveMarkerTween?.destroy();
    this.moveMarkerTween = null;
    this.moveMarker?.destroy();
    this.moveMarker = null;
  }

  /* ─── Helpers ─── */

  private getActiveAgent(): Agent {
    return this.agents.get(this.activeAgentId) ?? this.agents.values().next().value as Agent;
  }

  private getPrimaryAgent(): Agent | undefined {
    return this.agents.get(this.detectPrimaryId());
  }

  private static readonly PRIMARY_KEY = 'pixel-chat:primary-agent';

  private detectPrimaryId(): string {
    const stored = localStorage.getItem(OfficeScene.PRIMARY_KEY);
    if (stored && this.agents.has(stored)) return stored;
    return this.agents.keys().next().value as string ?? '';
  }

  static setPrimaryAgent(id: string): void {
    localStorage.setItem(OfficeScene.PRIMARY_KEY, id);
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

    eventBus.on('agent:set-primary', (id: string) => {
      if (!this.agents.has(id)) return;
      OfficeScene.setPrimaryAgent(id);
      this.activeAgentId = id;
      for (const [aid, agent] of this.agents) {
        agent.setActive(aid === id);
      }
      this.followActiveAgent();
      const agent = this.agents.get(id)!;
      this.emitAgentStatus(agent, 'Idle');
      console.log(`[OfficeScene] Primary agent set to: ${id}`);
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
