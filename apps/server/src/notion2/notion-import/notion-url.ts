const ALLOWED_HOST = /^([a-z0-9-]+\.)?notion\.(site|so)$/;
const PAGE_ID = /([0-9a-f]{32})$/i;

export interface NotionPageRef {
  /** dashed uuid */
  pageId: string;
  /** origin the unofficial API is served from */
  apiBaseUrl: string;
}

export function toDashedId(id: string): string {
  const hex = id.replace(/-/g, '').toLowerCase();
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Only Notion's own hosts are accepted: the server fetches whatever this
 * returns, so anything else would let a caller aim it at internal addresses.
 */
export function parseNotionUrl(input: string): NotionPageRef {
  let url: URL;
  try {
    url = new URL(String(input ?? '').trim());
  } catch {
    throw new Error('Not a valid URL');
  }

  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !ALLOWED_HOST.test(host)) {
    throw new Error('Only public notion.site / notion.so links are supported');
  }

  // The id is the tail of the last path segment ("Some-Title-<32 hex>").
  const lastSegment = url.pathname.split('/').filter(Boolean).pop() ?? '';
  const match = PAGE_ID.exec(lastSegment.replace(/-/g, ''));
  if (!match) {
    throw new Error('No Notion page id found in the URL');
  }

  const apiHost = host.endsWith('notion.site') ? host : 'www.notion.so';
  return {
    pageId: toDashedId(match[1]),
    apiBaseUrl: `https://${apiHost}/api/v3`,
  };
}
