export interface BrainThinkingEvent {
  type: 'thinking';
  content: string;
  status: 'start' | 'progress' | 'complete' | 'error';
}

export interface BrainActionEvent {
  type: 'action';
  action_type: string;
  title: string;
  status: 'running' | 'completed' | 'error';
  description?: string;
  agent_name?: string;
  agent_icon?: string;
  delegation_id?: string;
  duration_ms?: number;
  results_summary?: string;
  results_count?: string;
}

export interface BrainSourcesEvent {
  type: 'sources';
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
    favicon?: string;
  }>;
}

export interface BrainArtifactEvent {
  type: 'artifact';
  artifact_type: string;
  title: string;
  content_base64?: string;
  url?: string;
  format?: string;
}

export interface BrainStatusEvent {
  type: 'status';
  status_type: string;
  iteration?: number;
  max_iterations?: number;
  title?: string;
}

export type BrainEvent =
  | BrainThinkingEvent
  | BrainActionEvent
  | BrainSourcesEvent
  | BrainArtifactEvent
  | BrainStatusEvent;
