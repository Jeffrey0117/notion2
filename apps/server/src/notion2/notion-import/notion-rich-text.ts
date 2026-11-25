import { getBlock, NotionRecordMap, NotionText } from './notion-record';

export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function plainText(text?: NotionText): string {
  if (!Array.isArray(text)) return '';
  return text.map((chunk) => (chunk?.[0] === '‣' ? '' : (chunk?.[0] ?? ''))).join('');
}

function safeHref(href: string): string | null {
  if (typeof href !== 'string') return null;
  if (href.startsWith('/')) return `https://www.notion.so${href}`;
  return /^(https?:|mailto:)/i.test(href) ? href : null;
}

function formatDate(value: any): string {
  if (!value?.start_date) return '';
  const start = [value.start_date, value.start_time].filter(Boolean).join(' ');
  const end = [value.end_date, value.end_time].filter(Boolean).join(' ');
  return end ? `${start} → ${end}` : start;
}

/** Text a "‣" placeholder stands for: a mentioned page, a date, an equation. */
function mentionText(decorations: any[], map?: NotionRecordMap): string {
  for (const [kind, value] of decorations) {
    if (kind === 'p' && map) {
      return plainText(getBlock(map, value)?.properties?.title) || '';
    }
    if (kind === 'd') return formatDate(value);
    if (kind === 'e') return String(value ?? '');
  }
  return '';
}

/** Notion rich text → inline HTML the editor can parse. */
export function richTextToHtml(text?: NotionText, map?: NotionRecordMap): string {
  if (!Array.isArray(text)) return '';

  return text
    .map((chunk) => {
      const decorations = Array.isArray(chunk?.[1]) ? chunk[1] : [];
      const raw = chunk?.[0] === '‣' ? mentionText(decorations, map) : chunk?.[0];
      let html = escapeHtml(raw ?? '').replace(/\n/g, '<br>');
      if (!html) return '';

      for (const [kind, value] of decorations) {
        if (kind === 'b') html = `<strong>${html}</strong>`;
        else if (kind === 'i') html = `<em>${html}</em>`;
        else if (kind === 's') html = `<s>${html}</s>`;
        else if (kind === '_') html = `<u>${html}</u>`;
        else if (kind === 'c') html = `<code>${html}</code>`;
        else if (kind === 'a') {
          const href = safeHref(value);
          if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
        }
      }
      return html;
    })
    .join('');
}
