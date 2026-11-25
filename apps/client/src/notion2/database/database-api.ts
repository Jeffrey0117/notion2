import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { notifications } from "@mantine/notifications";
import api from "@/lib/api-client";
import {
  DatabaseColumn,
  DatabaseData,
  DatabaseInfo,
  DatabaseRow,
  DatabaseView,
  RowValues,
} from "./database-types";

const BASE = "/n2/databases";

async function post<T>(path: string, body: unknown): Promise<T> {
  const req = await api.post<T>(`${BASE}/${path}`, body);
  return req.data;
}

export function createDatabase(input: {
  spaceId: string;
  name: string;
  schema: DatabaseColumn[];
  views: DatabaseView[];
}) {
  return post<DatabaseInfo>("create", input);
}

export function getRowByPage(pageId: string) {
  return post<{ database: DatabaseInfo | null; row: DatabaseRow | null }>(
    "row-by-page",
    { pageId },
  );
}

const databaseKey = (id: string) => ["n2-database", id];
export const rowByPageKey = (pageId: string) => ["n2-database-row", pageId];

export function useDatabase(databaseId: string | null) {
  return useQuery({
    queryKey: databaseKey(databaseId),
    queryFn: () => post<DatabaseData>("info", { databaseId }),
    enabled: !!databaseId,
  });
}

export function useRowByPage(pageId: string) {
  return useQuery({
    queryKey: rowByPageKey(pageId),
    queryFn: () => getRowByPage(pageId),
    enabled: !!pageId,
  });
}

interface RowChange {
  title?: string;
  values?: RowValues;
}

/**
 * Every edit shows up at once and is then sent to the server. If the server
 * refuses, the database is reloaded so the screen never keeps a change that
 * was not saved.
 */
export function useDatabaseActions(databaseId: string) {
  const queryClient = useQueryClient();
  const key = useMemo(() => databaseKey(databaseId), [databaseId]);

  const patch = useCallback(
    (change: (data: DatabaseData) => DatabaseData) => {
      queryClient.setQueryData<DatabaseData>(key, (data) =>
        data ? change(data) : data,
      );
    },
    [queryClient, key],
  );

  const send = useCallback(
    async <T,>(path: string, body: Record<string, unknown>): Promise<T | null> => {
      try {
        return await post<T>(path, { databaseId, ...body });
      } catch (err) {
        notifications.show({
          color: "red",
          message: err?.response?.data?.message ?? "Could not save the change",
        });
        await queryClient.invalidateQueries({ queryKey: key });
        return null;
      }
    },
    [databaseId, queryClient, key],
  );

  return useMemo(
    () => ({
      rename(name: string) {
        patch((data) => ({ ...data, database: { ...data.database, name } }));
        return send("update", { name });
      },

      setSchema(schema: DatabaseColumn[]) {
        patch((data) => ({ ...data, database: { ...data.database, schema } }));
        return send<DatabaseInfo>("update", { schema });
      },

      setViews(views: DatabaseView[]) {
        patch((data) => ({ ...data, database: { ...data.database, views } }));
        return send<DatabaseInfo>("update", { views });
      },

      async setSchemaAndViews(schema: DatabaseColumn[], views: DatabaseView[]) {
        patch((data) => ({
          ...data,
          database: { ...data.database, schema, views },
        }));
        return send<DatabaseInfo>("update", { schema, views });
      },

      async addRow(values: RowValues = {}, title = "") {
        const row = await send<DatabaseRow>("rows/create", { values, title });
        if (row) patch((data) => ({ ...data, rows: [...data.rows, row] }));
        return row;
      },

      updateRow(rowId: string, change: RowChange) {
        patch((data) => ({
          ...data,
          rows: data.rows.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  title: change.title ?? row.title,
                  values: { ...row.values, ...change.values },
                }
              : row,
          ),
        }));
        return send("rows/update", { rowId, ...change });
      },

      deleteRow(rowId: string) {
        patch((data) => ({
          ...data,
          rows: data.rows.filter((row) => row.id !== rowId),
        }));
        return send("rows/delete", { rowId });
      },

      reload() {
        return queryClient.invalidateQueries({ queryKey: key });
      },
    }),
    [patch, send, queryClient, key],
  );
}

export type DatabaseActions = ReturnType<typeof useDatabaseActions>;
