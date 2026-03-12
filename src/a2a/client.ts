/**
 * A2A (Agent-to-Agent) Protocol Client
 *
 * Discovers agents from Brain via Agent Card.
 * Only fetches raw skill data — mapping to visual agents is done by AgentConfigService.
 */

import { getConfig } from '../config';

export interface A2ASkill {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface A2AAgentCard {
  name: string;
  description?: string;
  version?: string;
  supportedInterfaces: Array<{
    url: string;
    protocolBinding: string;
    protocolVersion: string;
  }>;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    extendedAgentCard?: boolean;
  };
  skills: A2ASkill[];
  provider?: {
    url: string;
    organization: string;
  };
}

export class A2AClient {
  private agentCard: A2AAgentCard | null = null;

  async fetchAgentCard(): Promise<A2AAgentCard | null> {
    const config = getConfig();
    const baseUrl = config.apiUrl || '';

    if (!baseUrl) {
      console.warn('[A2A] No API URL configured');
      return null;
    }

    try {
      const url = `${baseUrl}/.well-known/agent-card.json`;
      console.log('[A2A] Fetching Agent Card from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`[A2A] Failed to fetch Agent Card: ${response.status}`);
        return null;
      }

      const card: A2AAgentCard = await response.json();
      this.agentCard = card;
      console.log('[A2A] Agent Card loaded:', card.name, '- Skills:', card.skills?.length ?? 0);
      return card;
    } catch (error) {
      console.error('[A2A] Error fetching Agent Card:', error);
      return null;
    }
  }

  getCard(): A2AAgentCard | null {
    return this.agentCard;
  }

  clearCache(): void {
    this.agentCard = null;
  }
}

export const a2aClient = new A2AClient();
