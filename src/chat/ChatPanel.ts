import { eventBus } from '../events/EventBus';
import { getConfig, saveConfig, type BrainConfig } from '../config';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

export class ChatPanel {
  private container: HTMLElement;
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private currentMsgEl: HTMLElement | null = null;
  private currentBuffer = '';
  private streaming = false;

  constructor(parentId: string) {
    this.container = document.getElementById(parentId)!;
    this.render();
    this.bind();
    this.listen();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="chat-header">
        <h2>Pixel Chat</h2>
        <button class="settings-btn" title="Configuración">⚙</button>
      </div>
      <div class="chat-messages"></div>
      <div class="chat-input">
        <textarea placeholder="Escribe un mensaje..." rows="2"></textarea>
        <button class="send-btn">▶</button>
      </div>
    `;
    this.messagesEl = this.container.querySelector('.chat-messages')!;
    this.inputEl = this.container.querySelector('textarea')!;
    this.sendBtn = this.container.querySelector('.send-btn')!;
  }

  private bind(): void {
    this.sendBtn.addEventListener('click', () => this.onSend());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.onSend();
      }
    });
    this.container.querySelector('.settings-btn')!
      .addEventListener('click', () => this.showSettings());
  }

  private listen(): void {
    eventBus.on('chat:response-start', () => {
      this.streaming = true;
      this.sendBtn.textContent = '■';
      this.currentBuffer = '';
      this.currentMsgEl = this.addMessage('assistant', '');
    });

    eventBus.on('chat:token', (text: string) => {
      this.currentBuffer += text;
      if (this.currentMsgEl) {
        const contentEl = this.currentMsgEl.querySelector('.message-content')!;
        contentEl.innerHTML = marked.parse(this.currentBuffer) as string;
        this.scrollToBottom();
      }
    });

    eventBus.on('chat:response-end', () => {
      this.streaming = false;
      this.sendBtn.textContent = '▶';
      this.currentMsgEl = null;
      this.currentBuffer = '';
    });

    eventBus.on('chat:error', (msg: string) => {
      this.addMessage('system', msg);
    });
  }

  private onSend(): void {
    if (this.streaming) {
      eventBus.emit('chat:stop');
      return;
    }
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';
    this.addMessage('user', text);
    eventBus.emit('chat:send', text);
  }

  private addMessage(role: string, content: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `message message-${role}`;
    const avatars: Record<string, string> = {
      user: '👤', assistant: '🧠', system: '⚠',
    };
    const html = role === 'assistant' && content
      ? marked.parse(content) as string
      : this.escapeHtml(content);
    el.innerHTML = `
      <div class="message-avatar">${avatars[role] ?? '?'}</div>
      <div class="message-content">${html}</div>
    `;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private escapeHtml(s: string): string {
    const el = document.createElement('span');
    el.textContent = s;
    return el.innerHTML;
  }

  /* ─── Settings Modal ─── */

  private showSettings(): void {
    const cfg = getConfig();
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.innerHTML = `
      <div class="settings-panel">
        <h3>Configuración</h3>
        <label>Brain API URL
          <input id="cfg-url" type="text" value="${this.escapeHtml(cfg.apiUrl)}" />
        </label>
        <label>API Key
          <input id="cfg-key" type="password" value="${this.escapeHtml(cfg.apiKey)}" placeholder="sk-brain-..." />
        </label>
        <label>Modelo
          <input id="cfg-model" type="text" value="${this.escapeHtml(cfg.model)}" />
        </label>
        <div class="settings-actions">
          <button id="cfg-save">Guardar</button>
          <button id="cfg-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const val = (id: string) => (overlay.querySelector(`#${id}`) as HTMLInputElement).value;

    overlay.querySelector('#cfg-save')!.addEventListener('click', () => {
      saveConfig({ apiUrl: val('cfg-url'), apiKey: val('cfg-key'), model: val('cfg-model') });
      overlay.remove();
    });
    overlay.querySelector('#cfg-cancel')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
}
