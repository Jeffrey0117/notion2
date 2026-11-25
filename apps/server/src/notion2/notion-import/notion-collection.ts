import {
  collectionIdOf,
  getBlock,
  getCollection,
  NotionBlock,
  NotionRecordMap,
  NotionText,
} from './notion-record';
import { plainText } from './notion-rich-text';

const MAX_ROWS = 200;
const MAX_COLUMNS = 20;

export type ImportedColumnType = 'text' | 'number' | 'select' | 'checkbox' | 'date';

export interface ImportedColumn {
  id: string;
  name: string;
  type: ImportedColumnType;
  options?: { id: string; name: string; color: string }[];
}

export interface ImportedRow {
  title: string;
  values: Record<string, string | number | boolean | null>;
}

/** A Notion database reduced to what a notion2 database can hold. */
export interface ImportedDatabase {
  name: string;
  schema: ImportedColumn[];
  rows: ImportedRow[];
}

/** Notion column type → notion2 column type. Anything not listed is dropped. */
const TYPE_MAP: Record<string, ImportedColumnType> = {
  text: 'text',
  url: 'text',
  email: 'text',
  phone_number: 'text',
  multi_select: 'text',
  number: 'number',
  select: 'select',
  status: 'select',
  checkbox: 'checkbox',
  date: 'date',
};

const COLORS = new Set(['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']);

function rowIds(map: NotionRecordMap, collectionId: string, viewIds: string[]) {
  const queries = map.collection_query?.[collectionId] ?? {};
  for (const viewId of [...viewIds, ...Object.keys(queries)]) {
    const ids = queries[viewId]?.collection_group_results?.blockIds;
    if (Array.isArray(ids) && ids.length) return ids as string[];
  }
  return [];
}

function dateOf(value?: NotionText): string | null {
  for (const chunk of value ?? []) {
    for (const [kind, detail] of chunk?.[1] ?? []) {
      if (kind === 'd' && typeof detail?.start_date === 'string') return detail.start_date;
    }
  }
  return null;
}

function valueOf(column: ImportedColumn, value?: NotionText) {
  const text = plainText(value).trim();
  switch (column.type) {
    case 'checkbox':
      return text === 'Yes';
    case 'number':
      return text === '' || !Number.isFinite(Number(text)) ? null : Number(text);
    case 'date':
      return dateOf(value);
    case 'select':
      return column.options?.find((option) => option.name === text)?.id ?? null;
    default:
      return text || null;
  }
}

function toColumn(key: string, column: any, index: number): ImportedColumn | null {
  const type = TYPE_MAP[column?.type];
  if (!type) return null;

  const base: ImportedColumn = {
    id: `c${index}`,
    name: String(column.name ?? '').trim() || 'Column',
    type,
  };
  if (type !== 'select') return base;

  const options = (Array.isArray(column.options) ? column.options : []).map((option, i) => ({
    id: `c${index}o${i}`,
    name: String(option?.value ?? '').trim() || 'Option',
    color: COLORS.has(option?.color) ? option.color : 'gray',
  }));
  return { ...base, options };
}

/**
 * Reads a Notion database block. Returns null when the owner has not made the
 * database public. Formulas, rollups and relations have no counterpart and
 * are left out.
 */
export function readCollection(block: NotionBlock, map: NotionRecordMap): ImportedDatabase | null {
  const collectionId = collectionIdOf(block);
  const collection = collectionId ? getCollection(map, collectionId) : null;
  if (!collection) return null;

  const columns = Object.entries(collection.schema)
    .map(([key, column], index) => ({ key, column: toColumn(key, column, index) }))
    .filter((entry) => entry.column)
    .slice(0, MAX_COLUMNS);

  const rows = rowIds(map, collectionId, block.view_ids ?? [])
    .map((id) => getBlock(map, id))
    .filter(Boolean)
    .slice(0, MAX_ROWS)
    .map((row) => ({
      title: plainText(row.properties?.title).trim(),
      values: Object.fromEntries(
        columns.map(({ key, column }) => [column.id, valueOf(column, row.properties?.[key])]),
      ),
    }));

  return {
    name: plainText(collection.name).trim(),
    schema: columns.map(({ column }) => column),
    rows,
  };
}
