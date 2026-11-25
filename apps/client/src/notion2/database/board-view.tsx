import { useState } from "react";
import { Button, UnstyledButton } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { OptionBadge } from "./cells";
import { DatabaseActions } from "./database-api";
import {
  DatabaseColumn,
  DatabaseData,
  DatabaseRow,
  DatabaseView,
  newId,
} from "./database-types";
import classes from "./database.module.css";

interface BoardViewProps {
  data: DatabaseData;
  view: DatabaseView;
  actions: DatabaseActions;
  editable: boolean;
  onOpenRow: (row: DatabaseRow) => void;
}

const NO_GROUP = "__none__";

/** The column the board is grouped by: the view's choice, else the first select column. */
function groupColumn(schema: DatabaseColumn[], view: DatabaseView) {
  const selects = schema.filter((column) => column.type === "select");
  return selects.find((column) => column.id === view.groupBy) ?? selects[0];
}

export function BoardView({ data, view, actions, editable, onOpenRow }: BoardViewProps) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { database, rows } = data;
  const column = groupColumn(database.schema, view);

  if (!column) {
    const addStatusColumn = () => {
      const status: DatabaseColumn = {
        id: newId(),
        name: t("Status"),
        type: "select",
        options: [
          { id: newId(), name: t("Not started"), color: "gray" },
          { id: newId(), name: t("In progress"), color: "blue" },
          { id: newId(), name: t("Done"), color: "green" },
        ],
      };
      actions.setSchemaAndViews(
        [...database.schema, status],
        database.views.map((v) => (v.id === view.id ? { ...v, groupBy: status.id } : v)),
      );
    };

    return (
      <div className={classes.empty}>
        <span>{t("A board groups rows by a select column.")}</span>
        {editable && (
          <Button size="xs" variant="default" onClick={addStatusColumn}>
            {t("Add a status column")}
          </Button>
        )}
      </div>
    );
  }

  const options = column.options ?? [];
  const known = new Set(options.map((option) => option.id));
  const groups = [
    { id: NO_GROUP, option: null, value: null as string | null },
    ...options.map((option) => ({ id: option.id, option, value: option.id })),
  ].map((group) => ({
    ...group,
    rows: rows.filter((row) => {
      const value = row.values[column.id];
      return group.value === null ? !known.has(value as string) : value === group.value;
    }),
  }));

  const dropOn = (groupId: string, value: string | null, rowId: string) => {
    setDragOver(null);
    const row = rows.find((r) => r.id === rowId);
    if (!row || (row.values[column.id] ?? null) === value) return;
    actions.updateRow(rowId, { values: { [column.id]: value } });
  };

  return (
    <div className={classes.board}>
      {groups.map((group) => (
        <div
          key={group.id}
          className={classes.boardColumn}
          data-over={dragOver === group.id || undefined}
          onDragOver={(event) => {
            if (!editable) return;
            event.preventDefault();
            setDragOver(group.id);
          }}
          onDragLeave={() => setDragOver((current) => (current === group.id ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            dropOn(group.id, group.value, event.dataTransfer.getData("text/n2-row"));
          }}
        >
          <div className={classes.boardHeader}>
            {group.option ? (
              <OptionBadge option={group.option} />
            ) : (
              <span className={classes.boardNoGroup}>{t("No {{name}}", { name: column.name })}</span>
            )}
            <span className={classes.boardCount}>{group.rows.length}</span>
          </div>

          {group.rows.map((row) => (
            <UnstyledButton
              key={row.id}
              className={classes.card}
              draggable={editable}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/n2-row", row.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onOpenRow(row)}
            >
              {row.title || <span className={classes.untitled}>{t("Untitled")}</span>}
            </UnstyledButton>
          ))}

          {editable && (
            <UnstyledButton
              className={classes.addCard}
              onClick={() => actions.addRow(group.value ? { [column.id]: group.value } : {})}
            >
              <IconPlus size={14} />
              {t("New")}
            </UnstyledButton>
          )}
        </div>
      ))}
    </div>
  );
}
