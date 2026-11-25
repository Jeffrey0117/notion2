import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Cell } from "./cells";
import { rowByPageKey, useDatabaseActions, useRowByPage } from "./database-api";
import { DatabaseColumn, RowValue, SelectOption } from "./database-types";
import { COLUMN_TYPE_META } from "./table-view";
import classes from "./database.module.css";

interface RowPropertiesProps {
  pageId: string;
  editable: boolean;
}

/** On a page that is a database row: that row's fields, under the title. */
export function RowProperties({ pageId, editable }: RowPropertiesProps) {
  const { data } = useRowByPage(pageId);
  if (!data?.row || !data.database) return null;
  return (
    <RowFields
      pageId={pageId}
      editable={editable}
      databaseId={data.database.id}
      databaseName={data.database.name}
      schema={data.database.schema}
      rowId={data.row.id}
      values={data.row.values}
    />
  );
}

interface RowFieldsProps extends RowPropertiesProps {
  databaseId: string;
  databaseName: string;
  schema: DatabaseColumn[];
  rowId: string;
  values: Record<string, RowValue>;
}

function RowFields({
  pageId,
  editable,
  databaseId,
  databaseName,
  schema,
  rowId,
  values,
}: RowFieldsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const actions = useDatabaseActions(databaseId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: rowByPageKey(pageId) });

  const setValue = async (columnId: string, value: RowValue) => {
    await actions.updateRow(rowId, { values: { [columnId]: value } });
    await refresh();
  };

  const addOption = async (column: DatabaseColumn, option: SelectOption) => {
    await actions.setSchema(
      schema.map((c) =>
        c.id === column.id ? { ...c, options: [...(c.options ?? []), option] } : c,
      ),
    );
    await setValue(column.id, option.id);
  };

  if (!schema.length) return null;

  return (
    <div className={classes.properties} aria-label={databaseName || t("Untitled database")}>
      {schema.map((column) => {
        const Icon = COLUMN_TYPE_META[column.type].icon;
        return (
          <div key={column.id} className={classes.property}>
            <span className={classes.propertyName}>
              <Icon size={14} stroke={1.6} />
              {column.name}
            </span>
            <div className={classes.propertyValue}>
              <Cell
                column={column}
                value={values[column.id] ?? null}
                editable={editable}
                onChange={(value) => setValue(column.id, value)}
                onAddOption={(option) => addOption(column, option)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
