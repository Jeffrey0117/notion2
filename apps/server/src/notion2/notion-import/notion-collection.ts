import {
  collectionIdOf,
  getBlock,
  getCollection,
  NotionBlock,
  NotionRecordMap,
} from './notion-record';
import { escapeHtml, plainText, richTextToHtml } from './notion-rich-text';

const MAX_ROWS = 100;
const MAX_COLUMNS = 8;

/** Column types whose value is stored on the row and reads fine as text. */
const READABLE_TYPES = new Set([
  'title',
  'text',
  'number',
  'select',
  'multi_select',
  'status',
  'date',
  'checkbox',
  'url',
  'email',
  'phone_number',
]);

function rowIds(map: NotionRecordMap, collectionId: string, viewIds: string[]) {
  const queries = map.collection_query?.[collectionId] ?? {};
  for (const viewId of [...viewIds, ...Object.keys(queries)]) {
    const ids = queries[viewId]?.collection_group_results?.blockIds;
    if (Array.isArray(ids) && ids.length) return ids as string[];
  }
  return [];
}

function cellHtml(type: string, row: NotionBlock, key: string, map: NotionRecordMap) {
  const value = row.properties?.[key];
  if (type === 'checkbox') return plainText(value) === 'Yes' ? '✓' : '';
  return richTextToHtml(value, map);
}

/**
 * A Notion database becomes a heading plus a plain table. notion2 has no
 * database feature yet, so views, formulas, rollups and relations are dropped.
 */
export function collectionToHtml(block: NotionBlock, map: NotionRecordMap): string {
  const collectionId = collectionIdOf(block);
  const collection = collectionId ? getCollection(map, collectionId) : null;
  if (!collection) {
    return '<p><em>（這個資料庫沒有公開，抓不到內容）</em></p>';
  }

  const name = plainText(collection.name) || 'Untitled';
  const columns = Object.entries(collection.schema)
    .filter(([, column]) => READABLE_TYPES.has(column.type))
    .sort(([, a], [, b]) => Number(b.type === 'title') - Number(a.type === 'title'))
    .slice(0, MAX_COLUMNS);

  const rows = rowIds(map, collectionId, block.view_ids ?? [])
    .map((id) => getBlock(map, id))
    .filter(Boolean)
    .slice(0, MAX_ROWS);

  const heading = `<h3>${escapeHtml(name)}</h3>`;
  if (!columns.length || !rows.length) {
    return `${heading}<p><em>（這個資料庫的資料列沒有公開）</em></p>`;
  }

  const head = columns.map(([, column]) => `<th>${escapeHtml(column.name)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = columns
        .map(([key, column]) => `<td>${cellHtml(column.type, row, key, map)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `${heading}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
