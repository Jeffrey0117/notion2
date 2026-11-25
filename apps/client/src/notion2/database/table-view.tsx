import { useState } from "react";
import { ActionIcon, Menu, Select, TextInput, UnstyledButton } from "@mantine/core";
import {
  IconArrowUpRight,
  IconCalendar,
  IconCheckbox,
  IconHash,
  IconLetterCase,
  IconPlus,
  IconSelector,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Cell, TextCell } from "./cells";
import { DatabaseActions } from "./database-api";
import {
  ColumnType,
  DatabaseColumn,
  DatabaseData,
  DatabaseRow,
  newId,
  SelectOption,
} from "./database-types";
import classes from "./database.module.css";

export const COLUMN_TYPE_META: Record<
  ColumnType,
  { label: string; icon: typeof IconHash }
> = {
  text: { label: "Text", icon: IconLetterCase },
  number: { label: "Number", icon: IconHash },
  select: { label: "Select", icon: IconSelector },
  checkbox: { label: "Checkbox", icon: IconCheckbox },
  date: { label: "Date", icon: IconCalendar },
};

interface TableViewProps {
  data: DatabaseData;
  actions: DatabaseActions;
  editable: boolean;
  onOpenRow: (row: DatabaseRow) => void;
}

interface ColumnHeaderProps {
  column: DatabaseColumn;
  editable: boolean;
  onChange: (column: DatabaseColumn) => void;
  onDelete: () => void;
}

function ColumnHeader({ column, editable, onChange, onDelete }: ColumnHeaderProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(column.name);
  const Icon = COLUMN_TYPE_META[column.type].icon;

  const label = (
    <span className={classes.headerLabel}>
      <Icon size={14} stroke={1.6} />
      {column.name}
    </span>
  );

  if (!editable) return label;

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) onChange({ ...column, name: trimmed });
    else setName(column.name);
  };

  return (
    <Menu position="bottom-start" withinPortal shadow="md" width={220} onClose={commitName}>
      <Menu.Target>
        <UnstyledButton className={classes.headerButton}>{label}</UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <TextInput
          size="xs"
          mb={6}
          value={name}
          aria-label={t("Column name")}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") commitName();
          }}
        />
        <Select
          size="xs"
          mb={6}
          allowDeselect={false}
          comboboxProps={{ withinPortal: false }}
          aria-label={t("Column type")}
          value={column.type}
          data={Object.entries(COLUMN_TYPE_META).map(([value, meta]) => ({
            value,
            label: t(meta.label),
          }))}
          onChange={(type) => {
            if (!type || type === column.type) return;
            onChange({
              id: column.id,
              name: column.name,
              type: type as ColumnType,
              ...(type === "select" ? { options: [] } : {}),
            });
          }}
        />
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
          {t("Delete column")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export function TableView({ data, actions, editable, onOpenRow }: TableViewProps) {
  const { t } = useTranslation();
  const { database, rows } = data;
  const schema = database.schema;

  const replaceColumn = (column: DatabaseColumn) =>
    actions.setSchema(schema.map((c) => (c.id === column.id ? column : c)));

  const addOption = async (column: DatabaseColumn, row: DatabaseRow, option: SelectOption) => {
    await replaceColumn({ ...column, options: [...(column.options ?? []), option] });
    actions.updateRow(row.id, { values: { [column.id]: option.id } });
  };

  const addColumn = () =>
    actions.setSchema([...schema, { id: newId(), name: t("Column"), type: "text" }]);

  return (
    <div className={classes.tableScroll}>
      <table className={classes.table}>
        <thead>
          <tr>
            <th className={classes.nameColumn}>
              <span className={classes.headerLabel}>
                <IconLetterCase size={14} stroke={1.6} />
                {t("Name")}
              </span>
            </th>
            {schema.map((column) => (
              <th key={column.id}>
                <ColumnHeader
                  column={column}
                  editable={editable}
                  onChange={replaceColumn}
                  onDelete={() => actions.setSchema(schema.filter((c) => c.id !== column.id))}
                />
              </th>
            ))}
            <th className={classes.addColumn}>
              {editable && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={t("Add column")}
                  onClick={addColumn}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={classes.nameColumn}>
                <div className={classes.nameCell}>
                  <TextCell
                    className={classes.nameInput}
                    editable={editable}
                    value={row.title ?? ""}
                    placeholder={t("Untitled")}
                    onCommit={(title) => actions.updateRow(row.id, { title })}
                  />
                  <UnstyledButton
                    className={classes.openButton}
                    aria-label={t("Open as page")}
                    onClick={() => onOpenRow(row)}
                  >
                    <IconArrowUpRight size={13} />
                    {t("Open")}
                  </UnstyledButton>
                </div>
              </td>
              {schema.map((column) => (
                <td key={column.id}>
                  <Cell
                    column={column}
                    value={row.values[column.id] ?? null}
                    editable={editable}
                    onChange={(value) =>
                      actions.updateRow(row.id, { values: { [column.id]: value } })
                    }
                    onAddOption={(option) => addOption(column, row, option)}
                  />
                </td>
              ))}
              <td className={classes.addColumn}>
                {editable && (
                  <ActionIcon
                    className={classes.rowDelete}
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={t("Delete row")}
                    onClick={() => actions.deleteRow(row.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <UnstyledButton className={classes.addRow} onClick={() => actions.addRow()}>
          <IconPlus size={14} />
          {t("New")}
        </UnstyledButton>
      )}
    </div>
  );
}
