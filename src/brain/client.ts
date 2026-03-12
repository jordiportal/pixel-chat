import { getConfig } from '../config';
import { extractBrainEvents } from './event-parser';
import { eventBus } from '../events/EventBus';
import type { BrainEvent } from './types';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class BrainClient {
  private messages: Message[] = [];
  private controller: AbortController | null = null;

  constructor() {
    eventBus.on('chat:send', (text: string) => this.send(text));
    eventBus.on('chat:stop', () => this.stop());
    eventBus.on('chat:reset', () => this.reset());
  }

  private async send(userText: string): Promise<void> {
    this.messages.push({ role: 'user', content: userText });
    const config = getConfig();

    if (!config.apiKey) {
      eventBus.emit('chat:error', 'API Key no configurada. Pulsa ⚙ para configurar.');
      return;
    }

    this.controller = new AbortController();
    eventBus.emit('chat:response-start');

    let fullResponse = '';

    try {
      // Usar URL absoluta si está configurada, o relativa para compatibilidad
      const baseUrl = config.apiUrl || '';
      const url = baseUrl ? `${baseUrl}/v1/chat/completions` : '/v1/chat/completions';

      console.log('[BrainClient] POST', url, { model: config.model, messages: this.messages.length });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: this.messages,
          stream: true,
        }),
        signal: this.controller.signal,
      });

      console.log('[BrainClient] Response status:', res.status);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300) || res.statusText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const chunk = JSON.parse(payload);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              const { cleanText, events } = extractBrainEvents(delta);
              if (cleanText) {
                fullResponse += cleanText;
                eventBus.emit('chat:token', cleanText);
              }
              for (const ev of events) this.dispatchBrainEvent(ev);
            }
          } catch {
            /* skip malformed chunks */
          }
        }
      }

      this.messages.push({ role: 'assistant', content: fullResponse });
    } catch (err: any) {
      console.error('[BrainClient] Error:', err);
      if (err.name !== 'AbortError') {
        eventBus.emit('chat:error', err.message ?? 'Error desconocido');
      }
    } finally {
      this.controller = null;
      eventBus.emit('chat:response-end');
    }
  }

  private dispatchBrainEvent(ev: BrainEvent): void {
    eventBus.emit(`brain:${ev.type}`, ev);
  }

  private stop(): void {
    this.controller?.abort();
  }

  private reset(): void {
    this.stop();
    this.messages = [];
  }
}
