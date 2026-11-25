/**
 * Shapes of Notion's unofficial record map, narrowed to what the importer reads.
 * Records arrive wrapped once or twice ({ value } or { value: { value } }),
 * and anything the owner has not made public comes back as { role: 'none' }.
 */
export type NotionDecoration = [string, ...any[]];
export type NotionText = [string, NotionDecoration[]?][];

export interface NotionBlock {
  id: string;
  type: string;
  properties?: Record<string, NotionText>;
  format?: Record<string, any>;
  content?: string[];
  parent_id?: string;
  parent_table?: string;
  collection_id?: string;
  view_ids?: string[];
}

export interface NotionCollection {
  id: string;
  name?: NotionText;
  schema?: Record<string, { name: string; type: string }>;
}

export interface NotionRecordMap {
  block: Record<string, any>;
  collection?: Record<string, any>;
  collection_view?: Record<string, any>;
  collection_query?: Record<string, Record<string, any>>;
}

export function unwrap<T>(record: any): T | null {
  const value = record?.value?.value ?? record?.value;
  if (!value || typeof value !== 'object') return null;
  if (!value.id) return null;
  return value as T;
}

export function getBlock(map: NotionRecordMap, id: string): NotionBlock | null {
  const block = unwrap<NotionBlock>(map.block?.[id]);
  return block?.type ? block : null;
}

export function getCollection(
  map: NotionRecordMap,
  id: string,
): NotionCollection | null {
  const collection = unwrap<NotionCollection>(map.collection?.[id]);
  return collection?.schema ? collection : null;
}

export function collectionIdOf(block: NotionBlock): string | undefined {
  return block.collection_id ?? block.format?.collection_pointer?.id;
}
