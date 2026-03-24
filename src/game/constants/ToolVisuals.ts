export const ACTION_TYPE_TO_ICON: Record<string, string> = {
  web_search:  '🔍',
  web_fetch:   '🌐',
  python:      '🐍',
  shell:       '>_',
  javascript:  '⚙️',
  file_read:   '📖',
  file_write:  '✏️',
  image:       '🎨',
  slides:      '📊',
  delegate:    '🤝',
  planning:    '📋',
  rag_search:  '📚',
  rag_ingest:  '📥',
  data:        '📈',
  summarizing: '📝',
  code_exec:   '💻',
  calculate:   '🔢',
  think:       '💭',
  reflect:     '🪞',
};

export const ACTION_TYPE_TO_COLOR: Record<string, number> = {
  web_search:  0x44aadd,
  web_fetch:   0x44aadd,
  python:      0x3572A5,
  shell:       0x44bb66,
  javascript:  0xf7df1e,
  file_read:   0xaa8855,
  file_write:  0xaa8855,
  image:       0xee6688,
  slides:      0xee8844,
  delegate:    0xaa66cc,
  planning:    0x66aacc,
  rag_search:  0x8866aa,
  data:        0x44aa88,
  summarizing: 0x6688aa,
  code_exec:   0x44bb66,
  calculate:   0x66aa66,
};

export const FALLBACK_ICON = '⚡';
export const FALLBACK_COLOR = 0xffcc44;

export function getToolIcon(actionType: string): string {
  return ACTION_TYPE_TO_ICON[actionType] ?? FALLBACK_ICON;
}

export function getToolColor(actionType: string): number {
  return ACTION_TYPE_TO_COLOR[actionType] ?? FALLBACK_COLOR;
}
