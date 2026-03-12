/**
 * Agent Configuration Service
 *
 * Bridges A2A discovery with SQLite persistence.
 */

import { db, type AgentRow } from '../db/Database';
import { a2aClient, type A2ASkill } from '../a2a/client';
import { generateColors, findFreePosition, generateBrainNames, generateDisplayName } from '../utils/AgentGenerator';
import { eventBus } from '../events/EventBus';
import type { AgentDef } from '../game/map/OfficeMap';

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
  researcher: 'webCorner', web: 'webCorner', search: 'webCorner',
  image: 'library', media: 'library', 'image-generation': 'library',
  designer: 'library', slides: 'library', blender: 'library', '3d': 'library',
  rag: 'library', librarian: 'library',
  data: 'mainOffice', analysis: 'mainOffice', sap: 'mainOffice',
  orchestration: 'mainOffice', general: 'mainOffice', assistant: 'mainOffice',
  m365: 'mainOffice', email: 'mainOffice', calendar: 'mainOffice',
  communication: 'meetingRoom', storytelling: 'meetingRoom',
};

const ZONE_LIST = ['mainOffice', 'library', 'serverRoom', 'webCorner', 'meetingRoom'];

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

  private emitChange(): void {
    const agents = this.getAgentDefs();
    eventBus.emit('agents:loaded', { agents, source: 'config' });
  }
}

export const agentConfigService = new AgentConfigService();
