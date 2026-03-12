/**
 * Agent Registry — reads configured agents from SQLite via AgentConfigService.
 *
 * No fallback agents. If the DB is empty the office will be empty
 * until the user configures agents from the A2A panel.
 */

import { agentConfigService } from '../../services/AgentConfigService';
import type { AgentDef } from './OfficeMap';

class AgentRegistry {
  getAgents(): AgentDef[] {
    return agentConfigService.getAgentDefs();
  }

  getAgent(id: string): AgentDef | undefined {
    return this.getAgents().find(a => a.id === id);
  }

  findByBrainName(brainName: string): AgentDef | undefined {
    const lower = brainName.toLowerCase();
    return this.getAgents().find(a =>
      a.brainNames.some(n => lower.includes(n)) ||
      lower.includes(a.id) ||
      lower.includes(a.name.toLowerCase()),
    );
  }

  hasAgents(): boolean {
    return agentConfigService.hasAgents();
  }
}

export const agentRegistry = new AgentRegistry();
