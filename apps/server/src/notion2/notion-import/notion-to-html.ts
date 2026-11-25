import { collectionToHtml } from './notion-collection';
import { getBlock, NotionBlock, NotionRecordMap } from './notion-record';
import { escapeHtml, plainText, richTextToHtml } from './notion-rich-text';

export interface ConvertedPage {
  title: string;
  /** emoji only; Notion's uploaded or built-in icon images are dropped */
  icon: string | null;
  html: string;
  /** sub-pages found in the body, in order, for the caller to import next */
  childPageIds: string[];
}

interface Context {
  map: NotionRecordMap;
  childPageIds: string[];
  /** true while converting the inside of a column */
  inColumn: boolean;
}

const LIST_TAGS: Record<string, string> = {
  bulleted_list: 'ul',
  numbered_list: 'ol',
  to_do: 'ul data-type="taskList"',
};

const COLUMN_LAYOUTS: Record<number, string> = {
  2: 'two_equal',
  3: 'three_equal',
  4: 'four_equal',
  5: 'five_equal',
};

function isEmoji(icon: unknown): icon is string {
  return typeof icon === 'string' && icon.length <= 8 && !/[/:.]/.test(icon);
}

function sourceOf(block: NotionBlock): string {
  return block.format?.display_source ?? plainText(block.properties?.source);
}

function imageUrl(block: NotionBlock): string {
  const source = sourceOf(block);
  if (!source) return '';
  if (/^https?:\/\//.test(source) && !source.includes('amazonaws.com')) return source;
  // Uploaded files are private S3 objects; Notion's image proxy serves them for public pages.
  return `https://www.notion.so/image/${encodeURIComponent(source)}?table=block&id=${block.id}&cache=v2`;
}

function embedHtml(url: string): string {
  if (!/^https?:\/\//.test(url)) return '';
  const provider = /youtube\.com|youtu\.be/.test(url) ? 'youtube' : 'iframe';
  return `<div data-type="embed" data-src="${escapeHtml(url)}" data-provider="${provider}"></div>`;
}

function childrenHtml(block: NotionBlock, ctx: Context): string {
  return blocksToHtml(block.content ?? [], ctx);
}

function listItemHtml(block: NotionBlock, ctx: Context): string {
  const text = `<p>${richTextToHtml(block.properties?.title, ctx.map)}</p>`;
  const nested = childrenHtml(block, ctx);
  if (block.type !== 'to_do') return `<li>${text}${nested}</li>`;
  const checked = plainText(block.properties?.checked) === 'Yes';
  return `<li data-type="taskItem" data-checked="${checked}">${text}${nested}</li>`;
}

function columnsHtml(block: NotionBlock, ctx: Context): string {
  const columns = (block.content ?? [])
    .map((id) => getBlock(ctx.map, id))
    .filter(Boolean);
  const layout = COLUMN_LAYOUTS[columns.length];
  // No layout past five columns, and columns inside a column get too narrow
  // to read: stack the content instead.
  if (!layout || ctx.inColumn) {
    return columns.map((column) => childrenHtml(column, ctx)).join('');
  }

  const inner = columns
    .map((column) => {
      const body = childrenHtml(column, { ...ctx, inColumn: true });
      return `<div data-type="column">${body || '<p></p>'}</div>`;
    })
    .join('');
  return `<div data-type="columns" data-layout="${layout}">${inner}</div>`;
}

function tableHtml(block: NotionBlock, ctx: Context): string {
  const order: string[] = block.format?.table_block_column_order ?? [];
  const rows = (block.content ?? [])
    .map((id) => getBlock(ctx.map, id))
    .filter(Boolean)
    .map((row, index) => {
      const tag = index === 0 && block.format?.table_block_column_header ? 'th' : 'td';
      const cells = order
        .map((key) => `<${tag}>${richTextToHtml(row.properties?.[key], ctx.map)}</${tag}>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return rows ? `<table><tbody>${rows}</tbody></table>` : '';
}

function calloutHtml(block: NotionBlock, ctx: Context): string {
  const icon = block.format?.page_icon;
  const iconAttr = isEmoji(icon) ? ` data-callout-icon="${escapeHtml(icon)}"` : '';
  const title = richTextToHtml(block.properties?.title, ctx.map);
  const body = `${title ? `<p>${title}</p>` : ''}${childrenHtml(block, ctx)}` || '<p></p>';
  return `<div data-type="callout" data-callout-type="default"${iconAttr}>${body}</div>`;
}

function blockToHtml(block: NotionBlock, ctx: Context): string {
  const text = () => richTextToHtml(block.properties?.title, ctx.map);
  const withChildren = (html: string) => `${html}${childrenHtml(block, ctx)}`;

  switch (block.type) {
    case 'text':
      return withChildren(`<p>${text()}</p>`);
    case 'header':
      return withChildren(`<h1>${text()}</h1>`);
    case 'sub_header':
      return withChildren(`<h2>${text()}</h2>`);
    case 'sub_sub_header':
      return withChildren(`<h3>${text()}</h3>`);
    case 'quote':
      return `<blockquote><p>${text()}</p>${childrenHtml(block, ctx)}</blockquote>`;
    case 'divider':
      return '<hr>';
    case 'code':
      return `<pre><code>${escapeHtml(plainText(block.properties?.title))}</code></pre>`;
    case 'callout':
      return calloutHtml(block, ctx);
    case 'toggle':
      return `<details><summary>${text()}</summary><div data-type="detailsContent">${childrenHtml(block, ctx) || '<p></p>'}</div></details>`;
    case 'column_list':
      return columnsHtml(block, ctx);
    case 'table':
      return tableHtml(block, ctx);
    case 'image': {
      const src = imageUrl(block);
      return src ? `<img src="${escapeHtml(src)}">` : '';
    }
    case 'video':
    case 'embed':
    case 'figma':
    case 'maps':
    case 'codepen':
      return embedHtml(sourceOf(block));
    case 'bookmark': {
      const link = plainText(block.properties?.link);
      const label = plainText(block.properties?.title) || link;
      return link ? `<p><a href="${escapeHtml(link)}">${escapeHtml(label)}</a></p>` : '';
    }
    case 'equation':
      return `<p><code>${escapeHtml(plainText(block.properties?.title))}</code></p>`;
    case 'collection_view':
    case 'collection_view_page':
      return collectionToHtml(block, ctx.map);
    case 'page': {
      ctx.childPageIds.push(block.id);
      return `<p>📄 ${escapeHtml(plainText(block.properties?.title) || 'Untitled')}</p>`;
    }
    default:
      // Buttons, automations, synced blocks and the like have no counterpart here.
      return childrenHtml(block, ctx);
  }
}

function blocksToHtml(ids: string[], ctx: Context): string {
  const out: string[] = [];
  let listTag: string | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listTag) return;
    out.push(`<${listTag}>${listItems.join('')}</${listTag.split(' ')[0]}>`);
    listTag = null;
    listItems = [];
  };

  for (const id of ids) {
    const block = getBlock(ctx.map, id);
    if (!block) continue;

    const tag = LIST_TAGS[block.type];
    if (tag) {
      if (tag !== listTag) flushList();
      listTag = tag;
      listItems.push(listItemHtml(block, ctx));
      continue;
    }

    flushList();
    out.push(blockToHtml(block, ctx));
  }

  flushList();
  return out.join('');
}

/** One Notion page (already fetched) → title, icon and body HTML. */
export function notionPageToHtml(map: NotionRecordMap, pageId: string): ConvertedPage {
  const page = getBlock(map, pageId);
  if (!page) {
    throw new Error('This Notion page is not public, or the link is wrong');
  }

  const ctx: Context = { map, childPageIds: [], inColumn: false };
  const html =
    page.type === 'collection_view_page'
      ? collectionToHtml(page, map)
      : blocksToHtml(page.content ?? [], ctx);

  const icon = page.format?.page_icon;
  return {
    title: plainText(page.properties?.title).trim() || 'Untitled',
    icon: isEmoji(icon) ? icon : null,
    html: html || '<p></p>',
    childPageIds: ctx.childPageIds,
  };
}
