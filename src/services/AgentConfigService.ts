/**
 * Agent Configuration Service
 *
 * Bridges A2A discovery with SQLite persistence.
 */

import { db, type AgentRow, type ToolMappingRow } from '../db/Database';
import { a2aClient, type A2ASkill } from '../a2a/client';
import { generateColors, findFreePosition, generateBrainNames, generateDisplayName } from '../utils/AgentGenerator';
import { eventBus } from '../events/EventBus';
import { ACTION_TYPE_TO_ZONE, parseMapData, getWalkableSet, getZones, type ZoneDef, type AgentDef } from '../game/map/OfficeMap';
import { tileRegistry } from './TileRegistry';

export interface UnconfiguredSkill {
  skill: A2ASkill;
  suggested: {
    name: string;
    zone: string;
    bodyColor: string;
    hairColor: string;
    homeX: number;
    homeY: number;
    brainNames: string[];
  };
}

// Tags that hint at a specific zone
const TAG_TO_ZONE: Record<string, string> = {
  code: 'serverRoom', shell: 'serverRoom', developer: 'serverRoom',
  python: 'serverRoom', javascript: 'serverRoom',
  researcher: 'researchLab', web: 'researchLab', search: 'researchLab',
  rag: 'researchLab', librarian: 'researchLab', document: 'researchLab', knowledge: 'researchLab',
  image: 'creativeStudio', media: 'creativeStudio', 'image-generation': 'creativeStudio',
  designer: 'creativeStudio', slides: 'creativeStudio', blender: 'creativeStudio',
  '3d': 'creativeStudio', comfyui: 'creativeStudio', comfy: 'creativeStudio',
  data: 'mainOffice', analysis: 'mainOffice', sap: 'mainOffice',
  orchestration: 'mainOffice', general: 'mainOffice', assistant: 'mainOffice',
  m365: 'mainOffice', email: 'mainOffice', calendar: 'mainOffice',
  communication: 'meetingRoomA', storytelling: 'meetingRoomA',
};

const ZONE_LIST = ['mainOffice', 'creativeStudio', 'serverRoom', 'researchLab', 'meetingRoomA', 'meetingRoomB'];

class AgentConfigService {
  private cachedSkills: A2ASkill[] | null = null;

  /** Fetch skills from A2A and cache them */
  async fetchSkills(): Promise<A2ASkill[]> {
    const card = await a2aClient.fetchAgentCard();
    this.cachedSkills = card?.skills ?? [];
    return this.cachedSkills;
  }

  /** Get cached skills (call fetchSkills first) */
  getSkills(): A2ASkill[] {
    return this.cachedSkills ?? [];
  }

  /** Skills that don't have an agent configured in the DB */
  async getUnconfiguredSkills(): Promise<UnconfiguredSkill[]> {
    const skills = this.cachedSkills ?? await this.fetchSkills();
    const configured = db.getAllAgents();
    const configuredSkillIds = new Set(configured.map(a => a.skill_id));

    const occupiedPositions = new Set(
      configured.map(a => `${a.home_x},${a.home_y}`),
    );

    const result: UnconfiguredSkill[] = [];
    for (const skill of skills) {
      if (configuredSkillIds.has(skill.id)) continue;

      const zone = this.suggestZone(skill);
      const pos = findFreePosition(zone, occupiedPositions);
      const colors = generateColors(skill.id);

      result.push({
        skill,
        suggested: {
          name: generateDisplayName(skill.id, skill.name),
          zone,
          bodyColor: colors.bodyColor,
          hairColor: colors.hairColor,
          homeX: pos.x,
          homeY: pos.y,
          brainNames: generateBrainNames(skill.id, skill.tags),
        },
      });

      occupiedPositions.add(`${pos.x},${pos.y}`);
    }

    return result;
  }

  /** All agents stored in the DB */
  getConfiguredAgents(): AgentRow[] {
    return db.getAllAgents();
  }

  /** Convert a DB row to an AgentDef for Phaser */
  rowToAgentDef(row: AgentRow): AgentDef {
    return {
      id: row.id,
      name: row.name,
      bodyColor: row.body_color,
      hairColor: row.hair_color,
      homeX: row.home_x,
      homeY: row.home_y,
      zone: row.zone,
      brainNames: JSON.parse(row.brain_names),
    };
  }

  /** Get all configured agents as AgentDef[] */
  getAgentDefs(): AgentDef[] {
    return this.getConfiguredAgents().map(r => this.rowToAgentDef(r));
  }

  /** Save (create or update) an agent */
  async saveAgent(config: {
    id: string;
    name: string;
    skillId: string;
    bodyColor: string;
    hairColor: string;
    homeX: number;
    homeY: number;
    zone: string;
    brainNames: string[];
    avatarSeed?: string;
  }): Promise<void> {
    await db.upsertAgent({
      id: config.id,
      name: config.name,
      skill_id: config.skillId,
      body_color: config.bodyColor,
      hair_color: config.hairColor,
      home_x: config.homeX,
      home_y: config.homeY,
      zone: config.zone,
      brain_names: JSON.stringify(config.brainNames),
      avatar_seed: config.avatarSeed ?? null,
    });
    this.emitChange();
  }

  /** Configure all unconfigured skills at once with random appearance */
  async configureAllRandom(): Promise<number> {
    const unconfigured = await this.getUnconfiguredSkills();
    for (const u of unconfigured) {
      await this.saveAgent({
        id: this.sanitizeId(u.skill.id),
        name: u.suggested.name,
        skillId: u.skill.id,
        bodyColor: u.suggested.bodyColor,
        hairColor: u.suggested.hairColor,
        homeX: u.suggested.homeX,
        homeY: u.suggested.homeY,
        zone: u.suggested.zone,
        brainNames: u.suggested.brainNames,
        avatarSeed: u.skill.id,
      });
    }
    return unconfigured.length;
  }

  private static readonly ZONE_MIGRATION: Record<string, string> = {
    library: 'creativeStudio',
    webCorner: 'researchLab',
    meetingRoom: 'meetingRoomA',
  };

  private migrateZone(zone: string): string {
    const validZones = new Set(Object.keys(getZones()));
    if (validZones.has(zone)) return zone;
    const migrated = AgentConfigService.ZONE_MIGRATION[zone];
    if (migrated && validZones.has(migrated)) return migrated;
    return ZONE_LIST[0];
  }

  /** Redistribute all agents across their zones using the spacing algorithm */
  async redistributeAgents(): Promise<number> {
    const agents = db.getAllAgents();
    if (agents.length === 0) return 0;

    const occupied = new Set<string>();
    for (const agent of agents) {
      agent.zone = this.migrateZone(agent.zone);
      const pos = findFreePosition(agent.zone, occupied);
      agent.home_x = pos.x;
      agent.home_y = pos.y;
      occupied.add(`${pos.x},${pos.y}`);
    }

    for (const agent of agents) {
      await db.upsertAgent(agent);
    }

    this.emitChange();
    console.log(`[AgentConfig] Redistributed ${agents.length} agents`);
    return agents.length;
  }

  /** Delete an agent */
  async deleteAgent(id: string): Promise<void> {
    await db.deleteAgent(id);
    this.emitChange();
  }

  /** Delete all agents */
  async deleteAllAgents(): Promise<void> {
    await db.deleteAllAgents();
    this.emitChange();
  }

  /** Whether there are any configured agents */
  hasAgents(): boolean {
    return db.agentCount() > 0;
  }

  /** Suggest a zone based on skill tags */
  suggestZone(skill: A2ASkill): string {
    for (const tag of skill.tags) {
      const normalized = tag.toLowerCase().replace(/[_-]/g, '');
      if (TAG_TO_ZONE[normalized]) return TAG_TO_ZONE[normalized];
      if (TAG_TO_ZONE[tag.toLowerCase()]) return TAG_TO_ZONE[tag.toLowerCase()];
    }
    return ZONE_LIST[Math.floor(Math.random() * ZONE_LIST.length)];
  }

  /** Get available zones */
  getZones(): string[] {
    return [...ZONE_LIST];
  }

  /** Sanitize a skill ID to a valid agent ID */
  sanitizeId(skillId: string): string {
    return skillId
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'agent';
  }

  // ── Tool Mappings ─────────────────────────────────────────────

  private static readonly CORE_TOOLS: Array<{ name: string; label: string }> = [
    { name: 'web_search', label: 'Web Search' },
    { name: 'web_fetch', label: 'Web Fetch' },
    { name: 'python', label: 'Python' },
    { name: 'shell', label: 'Shell' },
    { name: 'javascript', label: 'JavaScript' },
    { name: 'code_exec', label: 'Code Exec' },
    { name: 'file_read', label: 'File Read' },
    { name: 'file_write', label: 'File Write' },
    { name: 'image', label: 'Image' },
    { name: 'slides', label: 'Slides' },
    { name: 'delegate', label: 'Delegate' },
    { name: 'data', label: 'Data' },
    { name: 'summarizing', label: 'Summarizing' },
    { name: 'planning', label: 'Planning' },
    { name: 'rag', label: 'RAG' },
    { name: 'blender', label: 'Blender 3D' },
    { name: 'email', label: 'Email' },
    { name: 'calendar', label: 'Calendar' },
    { name: 'sap', label: 'SAP' },
    { name: 'm365', label: 'Microsoft 365' },
  ];

  /** Tools for a specific agent: A2A skill tags + core tools */
  getToolsForAgent(agentId: string): Array<{ name: string; label: string; source: 'agent' | 'core' }> {
    const result: Array<{ name: string; label: string; source: 'agent' | 'core' }> = [];
    const seen = new Set<string>();

    // Agent-specific tools from A2A skill tags and brainNames
    const agentRow = db.getAgent(agentId);
    if (agentRow) {
      const skill = this.getSkills().find(s => s.id === agentRow.skill_id);
      if (skill) {
        for (const tag of skill.tags) {
          const t = tag.toLowerCase().replace(/[_\s-]+/g, '_');
          if (t && !seen.has(t) && t !== 'agent' && t !== 'chain') {
            seen.add(t);
            result.push({ name: t, label: tag, source: 'agent' });
          }
        }
      }
      const brainNames: string[] = JSON.parse(agentRow.brain_names || '[]');
      for (const bn of brainNames) {
        const t = bn.toLowerCase();
        if (t && !seen.has(t)) {
          seen.add(t);
          result.push({ name: t, label: bn, source: 'agent' });
        }
      }
    }

    for (const tool of AgentConfigService.CORE_TOOLS) {
      if (!seen.has(tool.name)) {
        seen.add(tool.name);
        result.push({ ...tool, source: 'core' });
      }
    }

    return result;
  }

  /** All known tools (agent-agnostic, for backward compat) */
  getKnownTools(): Array<{ name: string; label: string }> {
    return [...AgentConfigService.CORE_TOOLS];
  }

  /** Scan the map and return all interactable element instances with position + zone */
  getMapElements(): Array<{ type: string; label: string; x: number; y: number; zone: string; zoneLabel: string }> {
    const interactable = tileRegistry.interactableSet;
    const mapData = parseMapData();
    const elements: Array<{ type: string; label: string; x: number; y: number; zone: string; zoneLabel: string }> = [];

    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[y].length; x++) {
        const tile = mapData[y][x];
        if (!interactable.has(tile)) continue;

        const def = tileRegistry.getDef(tile);
        if (!def) continue;

        const zone = this.getZoneAt(x, y);
        elements.push({
          type: def.name.toUpperCase().replace(/\s+/g, '_'),
          label: def.name,
          x, y,
          zone: zone?.name ?? '?',
          zoneLabel: zone?.label ?? 'Exterior',
        });
      }
    }

    return elements;
  }

  private getZoneAt(x: number, y: number): ZoneDef | null {
    for (const z of Object.values(getZones())) {
      const b = z.bounds;
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return z;
    }
    return null;
  }

  getToolMappings(agentId: string): ToolMappingRow[] {
    return db.getToolMappingsForAgent(agentId);
  }

  async saveToolMapping(
    agentId: string, toolName: string, label: string,
    tileType?: string | null, targetX?: number | null, targetY?: number | null,
  ): Promise<void> {
    await db.upsertToolMapping({
      agent_id: agentId,
      tool_name: toolName,
      label,
      tile_type: tileType ?? null,
      target_x: targetX ?? null,
      target_y: targetY ?? null,
    });
  }

  async deleteToolMapping(agentId: string, toolName: string): Promise<void> {
    await db.deleteToolMapping(agentId, toolName);
  }

  /**
   * Resolve where an agent should walk for a given action_type.
   * Returns walkable {x, y} near the mapped element, or null for zone-POI fallback.
   */
  resolveToolTarget(agentId: string, actionType: string): { x: number; y: number } | null {
    const mappings = db.getToolMappingsForAgent(agentId);
    const mapping = mappings.find(m => m.tool_name === actionType);

    if (!mapping || mapping.target_x == null || mapping.target_y == null) {
      return null;
    }

    return this.findAdjacentWalkable(mapping.target_x, mapping.target_y);
  }

  /** Find the nearest walkable tile adjacent to (tx, ty) */
  private findAdjacentWalkable(tx: number, ty: number): { x: number; y: number } {
    const mapData = parseMapData();
    const offsets = [
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    const walkable = getWalkableSet();

    if (mapData[ty]?.[tx] !== undefined && walkable.has(mapData[ty][tx])) {
      return { x: tx, y: ty };
    }

    for (const [dx, dy] of offsets) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (mapData[ny]?.[nx] !== undefined && walkable.has(mapData[ny][nx])) {
        return { x: nx, y: ny };
      }
    }

    for (let r = 2; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (mapData[ny]?.[nx] !== undefined && walkable.has(mapData[ny][nx])) {
            return { x: nx, y: ny };
          }
        }
      }
    }

    return { x: tx, y: ty };
  }

  private emitChange(): void {
    const agents = this.getAgentDefs();
    eventBus.emit('agents:loaded', { agents, source: 'config' });
  }
}

export const agentConfigService = new AgentConfigService();
