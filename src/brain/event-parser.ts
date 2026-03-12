import { BrainEvent } from './types';

const BRAIN_EVENT_RE = /<!--BRAIN_EVENT:(.*?)-->/g;

export function extractBrainEvents(text: string): {
  cleanText: string;
  events: BrainEvent[];
} {
  const events: BrainEvent[] = [];

  const cleanText = text.replace(BRAIN_EVENT_RE, (_match, json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed && parsed.type) events.push(parsed as BrainEvent);
    } catch {
      console.warn('[event-parser] malformed Brain Event JSON:', json.slice(0, 120));
    }
    return '';
  });

  return { cleanText, events };
}
