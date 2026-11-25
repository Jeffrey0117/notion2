export type ColumnType = "text" | "number" | "select" | "checkbox" | "date";
export type ViewType = "table" | "board";

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
  groupBy?: string;
}

export type RowValue = string | number | boolean | null;
export type RowValues = Record<string, RowValue>;

export interface DatabaseInfo {
  id: string;
  spaceId: string;
  name: string;
  schema: DatabaseColumn[];
  views: DatabaseView[];
}

export interface DatabaseRow {
  id: string;
  databaseId: string;
  pageId: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  values: RowValues;
  position: string;
}

export interface DatabaseData {
  database: DatabaseInfo;
  rows: DatabaseRow[];
}

export const OPTION_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export function newId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function nextOptionColor(options: SelectOption[]): string {
  return OPTION_COLORS[options.length % OPTION_COLORS.length];
}
