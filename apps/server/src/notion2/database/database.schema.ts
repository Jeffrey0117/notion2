import { randomUUID } from 'crypto';

export const COLUMN_TYPES = ['text', 'number', 'select', 'checkbox', 'date'] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const VIEW_TYPES = ['table', 'board'] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface DatabaseColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: SelectOption[];
}

export interface DatabaseView {
  id: string;
  name: string;
  type: ViewType;
  /** board only: the select column cards are grouped by */
  groupBy?: string;
}

export type RowValue = string | number | boolean | null;
export type RowValues = Record<string, RowValue>;

const MAX_COLUMNS = 50;
const MAX_OPTIONS = 100;
const MAX_VIEWS = 20;
const MAX_NAME = 100;
const MAX_TEXT = 2000;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const COLOR_PATTERN = /^[a-z]{1,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function newId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 10);
}

function cleanId(id: unknown, taken: Set<string>): string {
  const candidate = typeof id === 'string' && ID_PATTERN.test(id) && !taken.has(id) ? id : newId();
  taken.add(candidate);
  return candidate;
}

function cleanName(name: unknown, fallback: string): string {
  const text = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) : '';
  return text || fallback;
}

function cleanOptions(options: unknown): SelectOption[] {
  if (!Array.isArray(options)) return [];
  const taken = new Set<string>();
  return options.slice(0, MAX_OPTIONS).map((option) => ({
    id: cleanId(option?.id, taken),
    name: cleanName(option?.name, 'Option'),
    color: typeof option?.color === 'string' && COLOR_PATTERN.test(option.color) ? option.color : 'gray',
  }));
}

/** Whatever the client sent, return a schema that is safe to store. */
export function sanitizeSchema(input: unknown): DatabaseColumn[] {
  if (!Array.isArray(input)) return [];
  const taken = new Set<string>();

  return input.slice(0, MAX_COLUMNS).map((column) => {
    const type: ColumnType = COLUMN_TYPES.includes(column?.type) ? column.type : 'text';
    const clean: DatabaseColumn = {
      id: cleanId(column?.id, taken),
      name: cleanName(column?.name, 'Column'),
      type,
    };
    return type === 'select' ? { ...clean, options: cleanOptions(column?.options) } : clean;
  });
}

export function sanitizeViews(input: unknown, schema: DatabaseColumn[]): DatabaseView[] {
  const selectIds = new Set(schema.filter((c) => c.type === 'select').map((c) => c.id));
  const taken = new Set<string>();

  const views = (Array.isArray(input) ? input : []).slice(0, MAX_VIEWS).map((view) => {
    const type: ViewType = VIEW_TYPES.includes(view?.type) ? view.type : 'table';
    const clean: DatabaseView = {
      id: cleanId(view?.id, taken),
      name: cleanName(view?.name, type === 'board' ? 'Board' : 'Table'),
      type,
    };
    return type === 'board' && selectIds.has(view?.groupBy) ? { ...clean, groupBy: view.groupBy } : clean;
  });

  return views.length ? views : [{ id: newId(), name: 'Table', type: 'table' }];
}

function cleanValue(column: DatabaseColumn, value: unknown): RowValue {
  switch (column.type) {
    case 'text':
      return typeof value === 'string' ? value.slice(0, MAX_TEXT) : null;
    case 'number': {
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      return typeof number === 'number' && Number.isFinite(number) ? number : null;
    }
    case 'checkbox':
      return value === true;
    case 'date':
      return typeof value === 'string' && DATE_PATTERN.test(value) ? value : null;
    case 'select':
      return column.options?.some((option) => option.id === value) ? (value as string) : null;
  }
}

/** Keeps only values for columns that exist, coerced to each column's type. */
export function sanitizeValues(schema: DatabaseColumn[], input: unknown): RowValues {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const values: RowValues = {};
  for (const column of schema) {
    if (column.id in source) values[column.id] = cleanValue(column, source[column.id]);
  }
  return values;
}
